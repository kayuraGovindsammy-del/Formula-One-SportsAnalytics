// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — reads data/sample/*.json from disk.
//
// This entire module disappears when Member 4's Postgres lands: every consumer
// below switches to SQL queries against database/schema.sql. Nothing outside
// models/ imports this file, so that swap is contained to the model layer.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// -- Raw file shapes --------------------------------------------------------
// These mirror data/sample/*.json exactly, including the `_source`/`_note`/
// `source` annotation fields, which are stripped before anything is returned
// from a model. They are deliberately separate from the entity types in
// types/ — those describe the API contract, these describe the sample files.

export interface RawDriver {
  driver_id: string;
  permanent_number: number;
  given_name: string;
  family_name: string;
  nationality: string;
  date_of_birth: string;
  constructor_id: string;
}

interface DriversFile {
  drivers: RawDriver[];
}

export interface RawRace {
  round: number;
  race_name: string;
  circuit_id: string;
  circuit_name: string;
  locality: string;
  country: string;
  date: string;
  has_sprint: boolean;
}

interface RacesFile {
  season: number;
  races: RawRace[];
}

export interface RawLap {
  driver_id: string;
  lap_number: number;
  position: number | null;
  lap_time_ms: number | null;
  is_pit_lap: boolean;
  is_valid: boolean;
  source?: string;
  note?: string;
}

interface LapsFile {
  session_id: string;
  laps: RawLap[];
}

export interface RawEvent {
  event_id: string;
  session_id: string;
  driver_id?: string;
  type: string;
  lap_number?: number;
  timestamp?: string;
  payload: Record<string, unknown>;
  source?: string;
  note?: string;
}

export interface RawSessionSummary {
  session_id: string;
  round: number;
  race_name: string;
  type: string;
  date: string;
  total_laps: number;
}

export interface RawClassificationResult {
  position: number;
  driver_id: string;
  constructor_id: string;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number;
}

export interface RawFastestLapResult {
  driver_id: string;
  lap_number: number;
  time_ms: number;
}

export interface RawSessionResult {
  fastest_lap: RawFastestLapResult;
  classification: RawClassificationResult[];
}

interface EventsFile {
  session: RawSessionSummary;
  events: RawEvent[];
  session_result: RawSessionResult;
}

// -- Repo-root resolution ---------------------------------------------------

/**
 * Walks upward from this module looking for the directory that contains
 * `data/sample`. Resolving against the module rather than `process.cwd()`
 * means the server behaves the same whether it's started from src/backend,
 * from the repo root, or from a compiled dist/ build (which sits at the same
 * depth as src/, but this survives that changing too).
 */
function findRepoRoot(startDir: string): string {
  let current = startDir;

  for (;;) {
    if (existsSync(join(current, "data", "sample"))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      throw new Error(
        `Could not locate a repo root containing data/sample, searching upward from ${startDir}`
      );
    }

    current = parent;
  }
}

const moduleDir = dirname(fileURLToPath(import.meta.url));

export const SAMPLE_DATA_DIR = join(findRepoRoot(moduleDir), "data", "sample");

function loadJsonFile<T>(fileName: string): T {
  return JSON.parse(readFileSync(join(SAMPLE_DATA_DIR, fileName), "utf8")) as T;
}

// -- One-time load at startup ----------------------------------------------
// Module-level consts: each file is read once when the process boots, never
// per request. A malformed or missing file fails at boot rather than on the
// first request that happens to need it.

const driversFile = loadJsonFile<DriversFile>("drivers.json");
const racesFile = loadJsonFile<RacesFile>("races.json");
const lapsFile = loadJsonFile<LapsFile>("laps.json");
const eventsFile = loadJsonFile<EventsFile>("events.json");

export const rawDrivers: readonly RawDriver[] = driversFile.drivers;
export const rawRaces: readonly RawRace[] = racesFile.races;
export const rawLaps: readonly RawLap[] = lapsFile.laps;
export const rawEvents: readonly RawEvent[] = eventsFile.events;

/** The session the sample lap data belongs to (laps.json has one session). */
export const lapsSessionId: string = lapsFile.session_id;

/** The single session summary described by events.json. */
export const rawSessionSummary: RawSessionSummary = eventsFile.session;

export const rawSessionResult: RawSessionResult =
  eventsFile.session_result;

/** races.json stores the season as a number; season_id is its string form. */
export const seasonId: string = String(racesFile.season);

/**
 * grand_prix_id isn't stored in races.json — it is derived as `{season}_R{round}`
 * with rounds zero-padded to two digits (for example `2025_R01`, `2025_R13`). Postgres stores it as a
 * real column, at which point this derivation goes away.
 *
 * Re-exported from utils/identifiers.ts rather than defined here: the Jolpica
 * ingestion needs the same rule, and must not import this module (loading it
 * reads all four sample JSON files as an import side effect).
 */
export { toGrandPrixId } from "../utils/identifiers.js";
