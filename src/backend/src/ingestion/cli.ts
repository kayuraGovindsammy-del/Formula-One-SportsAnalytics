// ---------------------------------------------------------------------------
// Argument parsing and orchestration for `npm run ingest`.
//
// Kept separate from scripts/ingest.ts so the argument handling and the run
// sequence are testable without a process, a database or a network.
// ---------------------------------------------------------------------------

import { JolpicaClient, type JolpicaClientOptions } from "./jolpicaClient.js";
import { buildSeasonIngestPlan, type SeasonIngestPlan } from "./transform.js";
import { ingestSeasonPlan, type IngestCounts, type Poolish } from "./ingestSeason.js";

export interface IngestOptions {
  season: string;
  includeSprints: boolean;
  /** Build and report the plan without writing to the database. */
  dryRun: boolean;
  /** Ignore cached responses, but still refresh the cache. */
  refresh: boolean;
  cacheDir: string | undefined;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export const USAGE = `Usage: npm run ingest -- --season <year> [options]

Options:
  --season <year>     Season to ingest, e.g. 2025 (required)
  --include-sprints   Also ingest SPRINT sessions and their points
  --dry-run           Fetch and map, print the plan, write nothing
  --refresh           Bypass the on-disk cache for this run
  --cache-dir <path>  Override the response cache location
  --help              Show this message`;

export function parseArgs(argv: readonly string[]): IngestOptions {
  let season: string | undefined;
  let includeSprints = false;
  let dryRun = false;
  let refresh = false;
  let cacheDir: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--season": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("--")) {
          throw new UsageError("--season requires a year, e.g. --season 2025");
        }

        season = value;
        index += 1;
        break;
      }

      case "--cache-dir": {
        const value = argv[index + 1];

        if (value === undefined || value.startsWith("--")) {
          throw new UsageError("--cache-dir requires a path");
        }

        cacheDir = value;
        index += 1;
        break;
      }

      case "--include-sprints":
        includeSprints = true;
        break;

      case "--dry-run":
        dryRun = true;
        break;

      case "--refresh":
        refresh = true;
        break;

      case "--help":
        throw new UsageError(USAGE);

      default:
        if (arg !== undefined && arg.startsWith("--season=")) {
          season = arg.slice("--season=".length);
          break;
        }

        if (arg !== undefined && arg.startsWith("--cache-dir=")) {
          cacheDir = arg.slice("--cache-dir=".length);
          break;
        }

        throw new UsageError(`Unknown argument '${String(arg)}'\n\n${USAGE}`);
    }
  }

  if (season === undefined) {
    throw new UsageError(`--season is required\n\n${USAGE}`);
  }

  if (!/^\d{4}$/.test(season)) {
    throw new UsageError(`--season must be a four-digit year, got '${season}'`);
  }

  return { season, includeSprints, dryRun, refresh, cacheDir };
}

export interface BuildPlanDeps {
  client: Pick<
    JolpicaClient,
    | "fetchSeasonResults"
    | "fetchSeasonSprintResults"
    | "fetchSeasonRaces"
    | "fetchSeasonPitStops"
  >;
  options: IngestOptions;
}

/**
 * The calendar is fetched even in races-only mode: `grand_prix.has_sprint` is
 * a property of the weekend, not of whether this run happened to ingest the
 * sprint session, and getting it from the calendar keeps the column correct
 * without the extra results pages.
 */
export async function buildPlan({
  client,
  options,
}: BuildPlanDeps): Promise<SeasonIngestPlan> {
  const [raceResults, calendar] = await Promise.all([
    client.fetchSeasonResults(options.season),
    client.fetchSeasonRaces(options.season),
  ]);

  const rounds = calendar.map((race) => race.round);
  const pitStopRaces = await client.fetchSeasonPitStops(options.season, rounds);

  const sprintRounds = new Set(
    calendar
      .filter((race) => hasSprintMarker(race))
      .map((race) => race.round)
  );

  const sprintResults = options.includeSprints
    ? await client.fetchSeasonSprintResults(options.season)
    : undefined;

  return buildSeasonIngestPlan({
    seasonId: options.season,
    raceResults,
    ...(sprintResults ? { sprintResults } : {}),
    pitStopRaces,
    sprintRounds,
  });
}

/**
 * The calendar entry for a sprint weekend carries a `Sprint` session block.
 * The schema for a calendar race deliberately does not model every session
 * key, so this reads the raw property.
 */
function hasSprintMarker(race: unknown): boolean {
  return (
    typeof race === "object" &&
    race !== null &&
    "Sprint" in race &&
    (race as { Sprint?: unknown }).Sprint !== undefined
  );
}

export type SeasonSource = BuildPlanDeps["client"];

export interface RunIngestDeps {
  options: IngestOptions;
  pool: Poolish;
  clientOptions?: JolpicaClientOptions;
  /** Injectable so the run sequence is testable without a network. */
  client?: SeasonSource;
  log?: (message: string) => void;
}

export interface IngestReport {
  plan: SeasonIngestPlan;
  counts: IngestCounts | null;
}

export async function runIngest({
  options,
  pool,
  clientOptions,
  client: injectedClient,
  log = console.log,
}: RunIngestDeps): Promise<IngestReport> {
  const client =
    injectedClient ??
    new JolpicaClient({
      refresh: options.refresh,
      ...(options.cacheDir !== undefined ? { cacheDir: options.cacheDir } : {}),
      onProgress: (message) => log(`  ${message}`),
      ...clientOptions,
    });

  log(
    `Ingesting season ${options.season}` +
      (options.includeSprints ? " (races + sprints)" : " (races only)") +
      (options.dryRun ? " [dry run]" : "")
  );

  const plan = await buildPlan({ client, options });

  log(
    [
      "",
      "Plan:",
      `  circuits                 ${plan.circuits.length}`,
      `  grand_prix               ${plan.grandPrix.length}`,
      `  sessions                 ${plan.sessions.length}`,
      `  drivers                  ${plan.drivers.length}`,
      `  constructors             ${plan.constructors.length}`,
      `  driver_constructor_links ${plan.driverConstructorLinks.length}`,
      `  race_results             ${plan.raceResults.length}`,
      `  pit_stops                ${plan.pitStops.length}`,
      `  retirements              ${plan.retirements.length}`,
    ].join("\n")
  );

  for (const warning of plan.warnings) {
    log(`  WARNING: ${warning}`);
  }

  if (options.dryRun) {
    log("\nDry run — nothing was written.");
    return { plan, counts: null };
  }

  const counts = await ingestSeasonPlan(pool, plan);

  log(
    `\nWrote ${counts.race_results} race_results, ` +
      `${counts.pit_stops} pit_stops and ${counts.retirements} retirements. Done.`
  );

  return { plan, counts };
}
