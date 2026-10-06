// ---------------------------------------------------------------------------
// The whitelisted tools the chat assistant may call.
//
// Every number the assistant can report comes from one of these, and each
// one reads through the same loaders and models as the public API — so the
// assistant can never disagree with the stats pages. The model only chooses
// which tool to call and with what arguments; those arguments are validated
// here, and a bad call comes back to the model as an error message rather
// than failing the request.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { getConstructorStandings } from "../controllers/constructors.controller.js";
import { loadDriverStatistics } from "../controllers/drivers.controller.js";
import { loadRaceStatistics } from "../controllers/races.controller.js";
import { ApiError } from "../middleware/ApiError.js";
import * as driversModel from "../models/drivers.model.js";
import * as eventsModel from "../models/events.model.js";
import * as qualifyingResultsModel from "../models/qualifyingResults.model.js";
import * as racesModel from "../models/races.model.js";
import type { Event } from "../types/event.types.js";
import { seasonParam } from "../utils/queryValidation.js";
import type { ToolDefinition } from "./llmClient.js";

/** The only season the app currently has data for. */
export const DEFAULT_SEASON = "2025";

/** Tool output is cut to this many characters before it reaches the model. */
export const MAX_TOOL_OUTPUT_CHARS = 12_000;

/** get_race_events includes at most this many example rows. */
export const MAX_EVENT_EXAMPLES = 8;

/**
 * get_race_events summarises up to this many events. A race has at most a
 * few dozen pit stops or penalties; position changes can run to hundreds.
 */
export const MAX_EVENTS_SUMMARISED = 500;

/** Width of the lap windows get_race_events reports its busiest period in. */
export const LAP_WINDOW_SIZE = 5;

const SEARCH_LIMIT = 10;

export interface ToolContext {
  /** Absolute base of this API, e.g. https://host/api/v1, for export links. */
  apiBaseUrl: string;
}

// -- Argument schemas ----------------------------------------------------------

/**
 * The stats endpoints' four-digit season, defaulting to the app's season.
 * Models sometimes send 2025 as a number, so that is accepted too.
 */
const season = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  seasonParam.optional()
).transform((value) => value ?? DEFAULT_SEASON);

const id = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(40);

const EVENT_TYPES = ["PIT_STOP", "PENALTY_ISSUED", "POSITION_CHANGE"] as const;
const DATASETS = ["races", "drivers", "constructors", "results", "laps"] as const;

const argumentSchemas = {
  search_drivers: z.strictObject({
    query: z.string().trim().min(1).max(100),
  }),
  search_races: z.strictObject({
    query: z.string().trim().max(100).optional(),
    season,
  }),
  get_driver_stats: z.strictObject({
    driver_id: id("driver_id"),
    season,
  }),
  get_constructor_standings: z.strictObject({
    season,
  }),
  get_race_summary: z.strictObject({
    grand_prix_id: id("grand_prix_id"),
  }),
  get_race_events: z.strictObject({
    grand_prix_id: id("grand_prix_id"),
    type: z.enum(EVENT_TYPES),
    driver_id: id("driver_id").optional(),
  }),
  get_export_link: z.strictObject({
    dataset: z.enum(DATASETS),
    format: z.enum(["csv", "json"]),
    season,
  }),
};

export type ToolName = keyof typeof argumentSchemas;
type ToolArgs<Name extends ToolName> = z.output<(typeof argumentSchemas)[Name]>;

// -- Definitions sent to the model ----------------------------------------------

const seasonProperty = {
  type: "string",
  pattern: "^\\d{4}$",
  description: `Four-digit season. Defaults to "${DEFAULT_SEASON}".`,
};

const gpIdProperty = {
  type: "string",
  description:
    "Grand prix id such as 2025_R13 (season, then R and the two-digit round). Find it with search_races.",
};

function tool(
  name: ToolName,
  description: string,
  properties: Record<string, unknown>,
  required: string[]
): ToolDefinition {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  tool(
    "search_drivers",
    "Find drivers by name. Returns driver ids, names, numbers and current teams.",
    { query: { type: "string", description: "Part of a driver's name." } },
    ["query"]
  ),
  tool(
    "search_races",
    "Find races in a season by race name, circuit or country, or list the whole season when query is omitted. Returns grand_prix_id, round, date and whether results exist.",
    {
      query: { type: "string", description: "Part of a race, circuit or country name." },
      season: seasonProperty,
    },
    []
  ),
  tool(
    "get_driver_stats",
    "A driver's season statistics: races entered, wins, podiums, DNFs, fastest laps, average finish, points and positions gained.",
    {
      driver_id: { type: "string", description: "Driver id, e.g. NOR. Find it with search_drivers." },
      season: seasonProperty,
    },
    ["driver_id"]
  ),
  tool(
    "get_constructor_standings",
    "Every constructor's points for a season, highest first.",
    { season: seasonProperty },
    []
  ),
  tool(
    "get_race_summary",
    "One race: its details, the classification (results), race statistics and the qualifying classification.",
    { grand_prix_id: gpIdProperty },
    ["grand_prix_id"]
  ),
  tool(
    "get_race_events",
    `A summary of the pit stops, penalties or position changes in a race, optionally for one driver: the total, the fastest pit stop, the busiest laps, and at most ${MAX_EVENT_EXAMPLES} example rows.`,
    {
      grand_prix_id: gpIdProperty,
      type: { type: "string", enum: [...EVENT_TYPES] },
      driver_id: { type: "string", description: "Optional driver id, e.g. NOR." },
    },
    ["grand_prix_id", "type"]
  ),
  tool(
    "get_export_link",
    "A download link for a dataset as CSV or JSON.",
    {
      dataset: { type: "string", enum: [...DATASETS] },
      format: { type: "string", enum: ["csv", "json"] },
      season: seasonProperty,
    },
    ["dataset", "format"]
  ),
];

// -- Output shaping -------------------------------------------------------------

/** 23_312 -> "23.3 s". Durations reach the model only in this form. */
export function formatDuration(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
}

/**
 * Replaces every `<name>_ms` number in a tool result with a `<name>`
 * display string ("23.3 s"), at any depth; a null stays null under the new
 * name. Applied to every tool's output, so the model never sees raw
 * milliseconds and cannot echo them back.
 */
export function humanizeDurations(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(humanizeDurations);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (key.endsWith("_ms") && (typeof field === "number" || field === null)) {
      result[key.slice(0, -3)] = field === null ? null : formatDuration(field);
    } else {
      result[key] = humanizeDurations(field);
    }
  }
  return result;
}

interface EventSummaryOptions {
  grand_prix_id: string;
  type: (typeof EVENT_TYPES)[number];
  driver_id: string | undefined;
  apiBaseUrl: string;
}

const EVENT_NOUNS: Record<(typeof EVENT_TYPES)[number], string> = {
  PIT_STOP: "pit stops",
  PENALTY_ISSUED: "penalties",
  POSITION_CHANGE: "position changes",
};

function payloadNumber(event: Event, key: string): number | undefined {
  const value: unknown = (event.payload as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * get_race_events' answer: counts and highlights instead of a raw list, so
 * the model has nothing long to copy into its reply. Durations stay in
 * milliseconds here; humanizeDurations converts them on the way out.
 */
export function summariseEvents(
  rows: readonly Event[],
  totalItems: number,
  options: EventSummaryOptions
): Record<string, unknown> {
  const noun = EVENT_NOUNS[options.type];
  const ordered = [...rows].sort(
    (a, b) => (a.lap_number ?? Infinity) - (b.lap_number ?? Infinity)
  );

  // Busiest window of LAP_WINDOW_SIZE laps (1-5, 6-10, ...); the earliest
  // window wins a tie.
  const perWindow = new Map<number, number>();
  for (const event of ordered) {
    if (event.lap_number === undefined) continue;
    const window = Math.floor((event.lap_number - 1) / LAP_WINDOW_SIZE);
    perWindow.set(window, (perWindow.get(window) ?? 0) + 1);
  }
  let busiest: { window: number; count: number } | undefined;
  for (const [window, count] of perWindow) {
    if (busiest === undefined || count > busiest.count) busiest = { window, count };
  }

  let fastest: Event | undefined;
  if (options.type === "PIT_STOP") {
    for (const event of ordered) {
      const duration = payloadNumber(event, "duration_ms");
      if (duration === undefined) continue;
      const best = fastest && payloadNumber(fastest, "duration_ms");
      if (best === undefined || duration < best) fastest = event;
    }
  }

  const params = new URLSearchParams({ type: options.type, per_page: "100" });
  if (options.driver_id) params.set("driver_id", options.driver_id);
  const fullListUrl = `${options.apiBaseUrl}/races/${encodeURIComponent(
    options.grand_prix_id
  )}/events?${params.toString()}`;

  const examples = ordered.slice(0, MAX_EVENT_EXAMPLES).map((event) => ({
    driver_id: event.driver_id ?? null,
    lap: event.lap_number ?? null,
    ...event.payload,
  }));

  const notes: string[] = [];
  if (totalItems > examples.length) {
    notes.push(
      `Showing ${examples.length} of ${totalItems} ${noun}. The full list is at full_list_url` +
        (options.driver_id ? "." : ", or ask about a specific driver.")
    );
  }
  if (totalItems > rows.length) {
    notes.push(`The summary covers the first ${rows.length} ${noun} only.`);
  }

  return {
    grand_prix_id: options.grand_prix_id,
    type: options.type,
    ...(options.driver_id ? { driver_id: options.driver_id } : {}),
    total_events: totalItems,
    ...(fastest
      ? {
          fastest_pit_stop: {
            driver_id: fastest.driver_id ?? null,
            lap: fastest.lap_number ?? null,
            duration_ms: payloadNumber(fastest, "duration_ms") ?? null,
          },
        }
      : {}),
    ...(busiest
      ? {
          busiest_laps: {
            from_lap: busiest.window * LAP_WINDOW_SIZE + 1,
            to_lap: (busiest.window + 1) * LAP_WINDOW_SIZE,
            count: busiest.count,
          },
        }
      : {}),
    examples,
    full_list_url: fullListUrl,
    ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
  };
}

// -- Implementations -------------------------------------------------------------

class ToolInputError extends Error {}

const implementations: {
  [Name in ToolName]: (args: ToolArgs<Name>, context: ToolContext) => Promise<unknown>;
} = {
  async search_drivers({ query }) {
    const { rows, total_items } = await driversModel.findAll({
      page: 1,
      per_page: SEARCH_LIMIT,
      search: query,
    });

    return {
      total_matches: total_items,
      drivers: rows.map((driver) => ({
        driver_id: driver.driver_id,
        name: `${driver.given_name} ${driver.family_name}`,
        number: driver.permanent_number,
        nationality: driver.nationality,
        constructor_id: driver.constructor_id,
        constructor_name: driver.constructor_name,
      })),
    };
  },

  async search_races({ query, season }) {
    const { rows, total_items } = await racesModel.findAll({
      page: 1,
      // A whole season fits in one page, so "list 2025" needs no paging.
      per_page: query ? SEARCH_LIMIT : 30,
      season,
      search: query || undefined,
    });

    return {
      season,
      total_matches: total_items,
      races: rows.map((race) => ({
        grand_prix_id: race.grand_prix_id,
        round: race.round,
        race_name: race.race_name,
        circuit_name: race.circuit_name,
        country: race.country,
        date: race.date,
        has_sprint: race.has_sprint,
        has_results: race.has_results,
      })),
    };
  },

  async get_driver_stats({ driver_id, season }) {
    const statistics = await loadDriverStatistics(driver_id, season);

    if (!statistics) {
      throw new ToolInputError(
        `Driver '${driver_id}' was not found. Use search_drivers to find the driver_id.`
      );
    }

    return statistics;
  },

  async get_constructor_standings({ season }) {
    const standings = await getConstructorStandings(season);

    return standings.standings.length > 0
      ? standings
      : { ...standings, note: `No race results are stored for ${season}.` };
  },

  async get_race_summary({ grand_prix_id }) {
    const race = await racesModel.findById(grand_prix_id);

    if (!race) {
      throw new ToolInputError(
        `Race '${grand_prix_id}' was not found. Use search_races to find the grand_prix_id.`
      );
    }

    let statistics: Awaited<ReturnType<typeof loadRaceStatistics>> = null;
    try {
      statistics = await loadRaceStatistics(grand_prix_id);
    } catch (error) {
      // A race with no RACE session has no statistics; that is "no data",
      // not a failure of the whole summary.
      if (!(error instanceof ApiError && error.httpStatus === 404)) throw error;
    }

    const qualifying = await qualifyingResultsModel.findByRace(grand_prix_id);

    // Only lap-derived classification rows lack `status`; fallback rows from
    // the published results carry it. Without a lap log, overtakes and
    // consistency cannot be derived, so their zeros/nulls mean "no data".
    const lapDataAvailable =
      statistics !== null &&
      statistics.classification.length > 0 &&
      statistics.classification.every((row) => row.status === undefined);

    return {
      race: {
        grand_prix_id: race.grand_prix_id,
        season: race.season_id,
        round: race.round,
        race_name: race.race_name,
        circuit_name: race.circuit_name,
        country: race.country,
        date: race.date,
        has_sprint: race.has_sprint,
      },
      lap_data_available: lapDataAvailable,
      ...(lapDataAvailable
        ? {}
        : {
            note:
              "No lap-by-lap data for this race: overtake_count and consistency_ms are not meaningful. Results and points come from the published classification.",
          }),
      statistics,
      qualifying: qualifying.classification,
    };
  },

  async get_race_events({ grand_prix_id, type, driver_id }, context) {
    const page = await eventsModel.findByRace(grand_prix_id, {
      page: 1,
      per_page: MAX_EVENTS_SUMMARISED,
      type,
      driver_id,
      session_type: "RACE",
    });

    if (!page) {
      throw new ToolInputError(
        `Race '${grand_prix_id}' was not found. Use search_races to find the grand_prix_id.`
      );
    }

    return summariseEvents(page.rows, page.total_items, {
      grand_prix_id,
      type,
      driver_id,
      apiBaseUrl: context.apiBaseUrl,
    });
  },

  async get_export_link({ dataset, format, season }, context) {
    const params = new URLSearchParams({ format, season });
    return {
      dataset,
      format,
      season,
      url: `${context.apiBaseUrl}/export/${dataset}?${params.toString()}`,
    };
  },
};

// -- Dispatch ------------------------------------------------------------------

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(argumentSchemas, name);
}

/** Serializes tool output for the model, cut to MAX_TOOL_OUTPUT_CHARS. */
export function formatToolOutput(value: unknown): string {
  const text = JSON.stringify(value);

  if (text.length <= MAX_TOOL_OUTPUT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}… [truncated: output exceeded ${MAX_TOOL_OUTPUT_CHARS} characters]`;
}

function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
    .join("; ");
}

export interface ToolResult {
  /** The tool name the model asked for, as given. */
  name: string;
  /** Whether a whitelisted tool ran and returned data. */
  ok: boolean;
  /** What is sent back to the model: tool output, or {"error": ...}. */
  content: string;
}

/**
 * Runs one tool call from the model. Never throws for a bad call: an unknown
 * tool, invalid JSON, invalid arguments or a not-found id all come back as an
 * error message the model can read and recover from. Unexpected failures
 * (e.g. the database being down) still propagate.
 */
export async function runTool(
  name: string,
  rawArguments: string,
  context: ToolContext
): Promise<ToolResult> {
  if (!isToolName(name)) {
    return {
      name,
      ok: false,
      content: toolError(
        `Unknown tool '${name}'. Available tools: ${Object.keys(argumentSchemas).join(", ")}.`
      ),
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = rawArguments.trim() === "" ? {} : JSON.parse(rawArguments);
  } catch {
    return { name, ok: false, content: toolError("Arguments must be a JSON object.") };
  }

  const parsed = argumentSchemas[name].safeParse(parsedJson);
  if (!parsed.success) {
    return {
      name,
      ok: false,
      content: toolError(`Invalid arguments for ${name}: ${describeIssues(parsed.error)}`),
    };
  }

  try {
    // The schema and implementation are looked up by the same name, so the
    // parsed arguments always match; TypeScript cannot correlate the two.
    const implementation = implementations[name] as (
      args: unknown,
      context: ToolContext
    ) => Promise<unknown>;
    const output = await implementation(parsed.data, context);
    return { name, ok: true, content: formatToolOutput(humanizeDurations(output)) };
  } catch (error) {
    if (error instanceof ToolInputError) {
      return { name, ok: false, content: toolError(error.message) };
    }
    throw error;
  }
}
