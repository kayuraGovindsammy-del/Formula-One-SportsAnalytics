import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QualifyingData } from "../models/qualifyingResults.model.js";

const mocks = vi.hoisted(() => ({
  findQualifying: vi.fn<(grandPrixId: string) => Promise<QualifyingData>>(),
}));

vi.mock("../models/drivers.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllDrivers,
    findById: fixtures.findDriverById,
    getConstructorIdByDriver: fixtures.getConstructorIdByDriver,
  };
});

vi.mock("../models/constructors.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findById: fixtures.findConstructorById,
    findSeasonPointRows: fixtures.findSeasonPointRows,
  };
});

vi.mock("../models/races.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllRaces,
    findById: fixtures.findRaceById,
    exists: fixtures.raceExists,
  };
});

vi.mock("../models/sessions.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findByRace: fixtures.findSessionsByRace,
    findBySeason: fixtures.findSessionsBySeason,
    findOneByRaceAndType: fixtures.findOneSessionByRaceAndType,
  };
});

vi.mock("../models/raceResults.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findByRace: fixtures.findRaceResults,
    findClassificationsBySessions: fixtures.findRaceResultsBySessions,
  };
});

vi.mock("../models/laps.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllLapsBySession,
    findAllBySessions: fixtures.findAllLapsBySessions,
    findByRace: fixtures.findLapsByRace,
  };
});

vi.mock("../models/events.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllEventsBySession,
    findAllBySessions: fixtures.findAllEventsBySessions,
    findByRace: vi.fn(fixtures.findEventsByRace),
  };
});

vi.mock("../models/qualifyingResults.model.js", () => ({
  findByRace: mocks.findQualifying,
}));

import { loadDriverStatistics } from "../controllers/drivers.controller.js";
import * as eventsModel from "../models/events.model.js";
import type { Event } from "../types/event.types.js";
import {
  DEFAULT_SEASON,
  MAX_EVENT_ROWS,
  MAX_TOOL_OUTPUT_CHARS,
  TOOL_DEFINITIONS,
  formatToolOutput,
  isToolName,
  runTool,
} from "./tools.js";

const context = { apiBaseUrl: "http://localhost:3001/api/v1" };

async function call(name: string, args: unknown) {
  const result = await runTool(name, JSON.stringify(args), context);
  return { ...result, body: JSON.parse(result.content) as Record<string, unknown> };
}

beforeEach(() => {
  mocks.findQualifying.mockReset();
  mocks.findQualifying.mockResolvedValue({ session_id: null, classification: [] });
});

describe("tool definitions", () => {
  it("offers exactly the whitelisted tools", () => {
    const names = TOOL_DEFINITIONS.map((definition) => definition.function.name);

    expect(names).toEqual([
      "search_drivers",
      "search_races",
      "get_driver_stats",
      "get_constructor_standings",
      "get_race_summary",
      "get_race_events",
      "get_export_link",
    ]);
    expect(names.every(isToolName)).toBe(true);
  });
});

describe("runTool: dispatch and validation", () => {
  it("returns an error message for an unknown tool instead of throwing", async () => {
    const result = await call("drop_tables", {});

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/^Unknown tool 'drop_tables'/);
  });

  it("does not treat inherited object keys as tools", async () => {
    expect((await call("constructor", {})).ok).toBe(false);
    expect((await call("toString", {})).ok).toBe(false);
  });

  it("returns an error message for arguments that are not JSON", async () => {
    const result = await runTool("search_drivers", "{not json", context);

    expect(result.ok).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      error: "Arguments must be a JSON object.",
    });
  });

  it("returns an error message for missing or invalid arguments", async () => {
    const missing = await call("search_drivers", {});
    expect(missing.ok).toBe(false);
    expect(missing.body.error).toMatch(/^Invalid arguments for search_drivers: query/);

    const badType = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "LAP_COMPLETED",
    });
    expect(badType.ok).toBe(false);
    expect(badType.body.error).toMatch(/type/);
  });

  it("rejects arguments the tool does not declare", async () => {
    const result = await call("get_constructor_standings", {
      season: "2025",
      sql: "DROP TABLE drivers",
    });

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/sql/);
  });
});

describe("season handling", () => {
  it("defaults to the app's season when none is given", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA" });

    expect(DEFAULT_SEASON).toBe("2025");
    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
  });

  it("accepts a season sent as a number", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA", season: 2025 });

    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
  });

  it("applies the four-digit rule from the stats endpoints", async () => {
    for (const season of ["abc", "25", "2025a"]) {
      const result = await call("get_driver_stats", { driver_id: "PIA", season });

      expect(result.ok).toBe(false);
      expect(result.body.error).toMatch(/season: Expected a four-digit season/);
    }
  });
});

describe("search tools", () => {
  it("finds drivers by name", async () => {
    const result = await call("search_drivers", { query: "piastri" });

    expect(result.ok).toBe(true);
    expect(result.body.drivers).toEqual([
      expect.objectContaining({ driver_id: "PIA", name: "Oscar Piastri" }),
    ]);
  });

  it("lists a season's races when no query is given", async () => {
    const result = await call("search_races", {});

    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
    expect(result.body.races).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ grand_prix_id: "2025_R13", has_results: true }),
      ])
    );
  });
});

describe("get_driver_stats", () => {
  it("returns exactly what GET /drivers/:id/stats returns", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA", season: "2025" });

    expect(result.body).toEqual(
      JSON.parse(JSON.stringify(await loadDriverStatistics("PIA", "2025")))
    );
  });

  it("tells the model when a driver does not exist", async () => {
    const result = await call("get_driver_stats", { driver_id: "ZZZ" });

    expect(result.ok).toBe(false);
    expect(result.body.error).toBe(
      "Driver 'ZZZ' was not found. Use search_drivers to find the driver_id."
    );
  });
});

describe("get_constructor_standings", () => {
  it("ranks constructors by summed points", async () => {
    const result = await call("get_constructor_standings", {});
    const standings = result.body.standings as Array<Record<string, unknown>>;

    expect(result.ok).toBe(true);
    expect(standings[0]).toEqual({ position: 1, constructor_id: "MCL", points: 43 });
  });

  it("notes when a season has no results rather than inventing a table", async () => {
    const result = await call("get_constructor_standings", { season: "1999" });

    expect(result.body).toEqual({
      season: "1999",
      standings: [],
      note: "No race results are stored for 1999.",
    });
  });
});

describe("get_race_summary", () => {
  it("combines race details, statistics and qualifying", async () => {
    mocks.findQualifying.mockResolvedValue({
      session_id: "2025_R13_QUALIFYING",
      classification: [
        {
          position: 1,
          driver_id: "NOR",
          given_name: "Lando",
          family_name: "Norris",
          constructor_id: "MCL",
          constructor_name: "McLaren",
          q1_time_ms: 64962,
          q2_time_ms: 64634,
          q3_time_ms: 63971,
        },
      ],
    });

    const result = await call("get_race_summary", { grand_prix_id: "2025_R13" });

    expect(result.ok).toBe(true);
    expect(result.body.race).toMatchObject({ grand_prix_id: "2025_R13", season: "2025" });
    expect(result.body.lap_data_available).toBe(true);
    expect(result.body.note).toBeUndefined();
    expect(result.body.statistics).toMatchObject({ grand_prix_id: "2025_R13" });
    expect(result.body.qualifying).toEqual([
      expect.objectContaining({ position: 1, driver_id: "NOR" }),
    ]);
    expect(mocks.findQualifying).toHaveBeenCalledWith("2025_R13");
  });

  it("flags a race without lap data so zeros are not read as facts", async () => {
    // 2025_R01 exists but has no sessions in the sample data.
    const result = await call("get_race_summary", { grand_prix_id: "2025_R01" });

    expect(result.ok).toBe(true);
    expect(result.body.lap_data_available).toBe(false);
    expect(result.body.statistics).toBeNull();
    expect(result.body.note).toMatch(/No lap-by-lap data/);
  });

  it("tells the model when a race does not exist", async () => {
    const result = await call("get_race_summary", { grand_prix_id: "2025_R99" });

    expect(result.ok).toBe(false);
    expect(result.body.error).toBe(
      "Race '2025_R99' was not found. Use search_races to find the grand_prix_id."
    );
    expect(mocks.findQualifying).not.toHaveBeenCalled();
  });
});

describe("get_race_events", () => {
  it(`returns at most ${MAX_EVENT_ROWS} events of the requested type`, async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "POSITION_CHANGE",
    });
    const events = result.body.events as Array<{ type: string }>;

    expect(result.ok).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(MAX_EVENT_ROWS);
    expect(result.body.returned).toBe(events.length);
    expect(events.every((event) => event.type === "POSITION_CHANGE")).toBe(true);
  });

  it(`asks the model layer for at most ${MAX_EVENT_ROWS} rows and says when more exist`, async () => {
    const pitStop = (n: number): Event => ({
      event_id: `evt_${n}`,
      session_id: "2025_R13_RACE",
      driver_id: "PIA",
      type: "PIT_STOP",
      lap_number: n,
      timestamp: null,
      payload: {} as Event["payload"],
    });
    vi.mocked(eventsModel.findByRace).mockResolvedValueOnce({
      rows: Array.from({ length: MAX_EVENT_ROWS }, (_, n) => pitStop(n)),
      total_items: 40,
    });

    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "PIT_STOP",
    });

    expect(eventsModel.findByRace).toHaveBeenLastCalledWith("2025_R13", {
      page: 1,
      per_page: MAX_EVENT_ROWS,
      type: "PIT_STOP",
      driver_id: undefined,
      session_type: "RACE",
    });
    expect(result.body).toMatchObject({
      total_items: 40,
      returned: MAX_EVENT_ROWS,
      note: `Only the first ${MAX_EVENT_ROWS} events are included.`,
    });
  });

  it("filters by driver", async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "PIT_STOP",
      driver_id: "PIA",
    });
    const events = result.body.events as Array<{ driver_id?: string }>;

    expect(result.ok).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.driver_id === "PIA")).toBe(true);
  });

  it("tells the model when a race does not exist", async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R99",
      type: "PIT_STOP",
    });

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/^Race '2025_R99' was not found/);
  });
});

describe("get_export_link", () => {
  it("builds an absolute /export URL with the default season", async () => {
    const result = await call("get_export_link", { dataset: "results", format: "csv" });

    expect(result.body).toEqual({
      dataset: "results",
      format: "csv",
      season: "2025",
      url: "http://localhost:3001/api/v1/export/results?format=csv&season=2025",
    });
  });

  it("rejects a dataset that does not exist", async () => {
    const result = await call("get_export_link", { dataset: "users", format: "csv" });

    expect(result.ok).toBe(false);
  });
});

describe("formatToolOutput", () => {
  it("passes small output through unchanged", () => {
    expect(formatToolOutput({ a: 1 })).toBe('{"a":1}');
  });

  it("cuts large output to the limit and says so", () => {
    const text = formatToolOutput({ rows: "x".repeat(MAX_TOOL_OUTPUT_CHARS * 2) });

    expect(text.length).toBeLessThan(MAX_TOOL_OUTPUT_CHARS + 100);
    expect(text).toMatch(/\[truncated: output exceeded \d+ characters\]$/);
  });
});
