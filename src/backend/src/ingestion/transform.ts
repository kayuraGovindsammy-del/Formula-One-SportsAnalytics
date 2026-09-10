// ---------------------------------------------------------------------------
// Jolpica -> schema.sql mapping. Pure: no I/O, no pg, no Express.
//
// Every decision that is not a mechanical field copy is documented at the
// point it is applied, because most of them are not recoverable from the data
// alone.
// ---------------------------------------------------------------------------

import { toGrandPrixId, toSessionId } from "../utils/identifiers.js";
import type {
  JolpicaConstructor,
  JolpicaDriver,
  JolpicaRace,
  JolpicaResult,
} from "./jolpica.types.js";

/** Mirrors the `result_status` enum in database/schema.sql. */
export type ResultStatus = "FINISHED" | "DNF" | "DSQ";

/** The subset of `session_type` this pipeline writes. */
export type IngestedSessionType = "RACE" | "SPRINT";

export interface SeasonRow {
  season_id: string;
  year: number;
}

export interface CircuitRow {
  circuit_id: string;
  circuit_name: string;
  locality: string | null;
  country: string;
}

export interface GrandPrixRow {
  grand_prix_id: string;
  season_id: string;
  round: number;
  race_name: string;
  circuit_id: string;
  race_date: string;
  has_sprint: boolean;
}

export interface SessionRow {
  session_id: string;
  grand_prix_id: string;
  type: IngestedSessionType;
  total_laps: number | null;
}

export interface DriverRow {
  driver_id: string;
  permanent_number: number | null;
  given_name: string;
  family_name: string;
  nationality: string | null;
  date_of_birth: string | null;
}

export interface ConstructorRow {
  constructor_id: string;
  name: string;
  nationality: string | null;
}

export interface DriverConstructorLinkRow {
  season_id: string;
  driver_id: string;
  constructor_id: string;
}

export interface RaceResultRow {
  session_id: string;
  driver_id: string;
  constructor_id: string;
  position: number | null;
  grid_position: number | null;
  points: number;
  laps_completed: number;
  gap_to_winner_ms: number | null;
  status: ResultStatus;
}

export interface SeasonIngestPlan {
  season: SeasonRow;
  circuits: CircuitRow[];
  grandPrix: GrandPrixRow[];
  sessions: SessionRow[];
  drivers: DriverRow[];
  constructors: ConstructorRow[];
  driverConstructorLinks: DriverConstructorLinkRow[];
  raceResults: RaceResultRow[];
  warnings: string[];
}

// -- Constructor identity ---------------------------------------------------

/**
 * Jolpica constructor ids (`red_bull`, `mclaren`) are not this schema's
 * constructor ids (`RBR`, `MCL`). The short codes are already load-bearing:
 * database/seed.sql, models/constructors.model.ts and the frontend's
 * data/constructors.ts all key off them, and race_results.constructor_id is a
 * foreign key. Ingesting the Jolpica spelling would create a second row for
 * every team and split the results between them.
 *
 * The 2025 grid maps 1:1 onto the ten codes already seeded.
 */
export const CONSTRUCTOR_ID_BY_JOLPICA_ID: Readonly<Record<string, string>> = {
  red_bull: "RBR",
  mclaren: "MCL",
  ferrari: "FER",
  mercedes: "MER",
  aston_martin: "AMR",
  williams: "WIL",
  rb: "RB",
  haas: "HAA",
  alpine: "ALP",
  sauber: "SAU",
};

/**
 * Display names, where the repo's established name differs from Jolpica's.
 * Jolpica calls them "Red Bull", "Alpine F1 Team", "Sauber"; the rest of this
 * project has always said "Red Bull Racing", "Alpine", "Kick Sauber".
 * Keeping the project's spelling avoids the UI changing under a data refresh.
 */
export const CONSTRUCTOR_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  RBR: "Red Bull Racing",
  ALP: "Alpine",
  SAU: "Kick Sauber",
  RB: "Racing Bulls",
};

/**
 * Falls back to an uppercased, truncated slug for a team this map has never
 * seen — a new entrant should land in the database under a stable id rather
 * than abort a season ingest. constructor_id is VARCHAR(20).
 */
export function toConstructorId(jolpicaConstructorId: string): string {
  const mapped = CONSTRUCTOR_ID_BY_JOLPICA_ID[jolpicaConstructorId];

  if (mapped !== undefined) {
    return mapped;
  }

  return jolpicaConstructorId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

export function toConstructorRow(source: JolpicaConstructor): ConstructorRow {
  const constructorId = toConstructorId(source.constructorId);

  return {
    constructor_id: constructorId,
    name: CONSTRUCTOR_NAME_OVERRIDES[constructorId] ?? source.name,
    nationality: source.nationality ?? null,
  };
}

// -- Driver identity --------------------------------------------------------

/**
 * `drivers.driver_id` is VARCHAR(10) and every existing row is a three-letter
 * code (VER, NOR). Jolpica's `driverId` is a slug — and `max_verstappen` is 14
 * characters, so it would not fit the column even if the convention allowed
 * it. `Driver.code` is the three-letter code and is present on all 479 result
 * rows of the 2025 season; the slug fallback exists only for the reserve
 * drivers who appear in the season's driver list but never start a race.
 */
export function toDriverId(driver: JolpicaDriver): string {
  if (driver.code !== undefined && driver.code.trim() !== "") {
    return driver.code.trim().toUpperCase().slice(0, 10);
  }

  const fromFamilyName = driver.familyName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

  if (fromFamilyName.length === 3) {
    return fromFamilyName;
  }

  return driver.driverId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

/**
 * `permanentNumber` on the Driver object is the driver's CURRENT career
 * number, which Jolpica rewrites when a champion takes #1 — it reports
 * Norris as 1 and Verstappen as 3 for 2025, the reverse of what they actually
 * raced. The per-result `number` is the number carried in that season, which
 * is both what database/seed.sql records and what a season view should show.
 */
export function toDriverRow(
  driver: JolpicaDriver,
  seasonNumber?: number
): DriverRow {
  return {
    driver_id: toDriverId(driver),
    permanent_number: seasonNumber ?? driver.permanentNumber ?? null,
    given_name: driver.givenName,
    family_name: driver.familyName,
    nationality: driver.nationality ?? null,
    date_of_birth: driver.dateOfBirth ?? null,
  };
}

// -- Result status ----------------------------------------------------------

/**
 * Jolpica normalises 2025 finishing statuses to five strings: Finished,
 * Lapped, Retired, Disqualified, Did not start. The classic Ergast spellings
 * ("+1 Lap", "Accident", "Engine", ...) are handled too, because older
 * seasons and the upstream Ergast mirror still emit them.
 *
 * "Lapped" is a FINISHED classification — a driver two laps down still
 * finished the race and is ranked.
 *
 * "Did not start" folds into DNF. The `result_status` enum has three members
 * and adding a DNS would require a migration on a shared enum plus a matching
 * change everywhere DNF is counted; a DNS is a non-finish, and treating it as
 * one keeps DNF rate meaning "races entered but not finished".
 */
export function toResultStatus(
  status: string,
  positionText: string
): ResultStatus {
  const normalised = status.trim().toLowerCase();

  if (normalised === "disqualified") {
    return "DSQ";
  }

  if (normalised === "finished" || normalised === "lapped") {
    return "FINISHED";
  }

  // Classic Ergast lapped spelling: "+1 Lap", "+3 Laps".
  if (/^\+\d+\s+laps?$/.test(normalised)) {
    return "FINISHED";
  }

  if (normalised === "did not start" || normalised === "did not qualify") {
    return "DNF";
  }

  // Anything else Ergast reports is a mechanical or incident retirement.
  // Fall back on positionText, which is authoritative about classification:
  // a numeric value means the driver was classified.
  if (/^\d+$/.test(positionText.trim())) {
    return "FINISHED";
  }

  return "DNF";
}

/**
 * `position` is the finishing slot. Ergast populates it even for retirements
 * (as an ordering), so `positionText` is what decides whether the number is a
 * real classification. An unclassified driver gets NULL rather than a
 * position that would count as a podium in driverStatistics.
 */
export function toClassifiedPosition(result: JolpicaResult): number | null {
  return /^\d+$/.test(result.positionText.trim()) ? result.position : null;
}

// -- Rows -------------------------------------------------------------------

export function toCircuitRow(race: JolpicaRace): CircuitRow {
  return {
    circuit_id: race.Circuit.circuitId,
    circuit_name: race.Circuit.circuitName,
    locality: race.Circuit.Location?.locality ?? null,
    country: race.Circuit.Location?.country ?? "",
  };
}

export function toGrandPrixRow(
  race: JolpicaRace,
  seasonId: string,
  hasSprint: boolean
): GrandPrixRow {
  return {
    grand_prix_id: toGrandPrixId(seasonId, race.round),
    season_id: seasonId,
    round: race.round,
    race_name: race.raceName,
    circuit_id: race.Circuit.circuitId,
    race_date: race.date,
    has_sprint: hasSprint,
  };
}

/**
 * `Time.millis` is total elapsed race time for every classified finisher, not
 * a gap — Ergast renders it as "+0.895" for display but the millis field is
 * absolute. The gap is therefore a subtraction against the winner, and is
 * unavailable (NULL) for lapped or retired drivers, who carry no Time at all.
 *
 * Taken from the source rather than derived for the same reason as points:
 * this is the published classification, and the lap log needed to derive it
 * does not exist for these races.
 */
function toGapToWinnerMs(
  result: JolpicaResult,
  winnerMillis: number | null
): number | null {
  const millis = result.Time?.millis;

  if (millis === undefined || winnerMillis === null) {
    return null;
  }

  const gap = millis - winnerMillis;

  return gap >= 0 ? gap : null;
}

function findWinnerMillis(results: readonly JolpicaResult[]): number | null {
  for (const result of results) {
    if (result.position === 1) {
      return result.Time?.millis ?? null;
    }
  }

  return null;
}

export function toRaceResultRows(
  race: JolpicaRace,
  seasonId: string,
  sessionType: IngestedSessionType
): RaceResultRow[] {
  const results = sessionType === "SPRINT" ? race.SprintResults : race.Results;

  if (results === undefined || results.length === 0) {
    return [];
  }

  const sessionId = toSessionId(
    toGrandPrixId(seasonId, race.round),
    sessionType
  );
  const winnerMillis = findWinnerMillis(results);

  return results.map((result) => ({
    session_id: sessionId,
    driver_id: toDriverId(result.Driver),
    constructor_id: toConstructorId(result.Constructor.constructorId),
    position: toClassifiedPosition(result),
    grid_position: result.grid ?? null,
    // Points come straight from Jolpica. No points table is encoded anywhere
    // in this project, and the scoring rules vary by era, by sprint, and by
    // race-distance shortening (half points). Deriving them would mean
    // hard-coding a rule set that the source already applies correctly.
    points: result.points,
    laps_completed: result.laps ?? 0,
    gap_to_winner_ms: toGapToWinnerMs(result, winnerMillis),
    status: toResultStatus(result.status, result.positionText),
  }));
}

// -- Mid-season constructor changes -----------------------------------------

interface DriverTeamSighting {
  round: number;
  constructorId: string;
}

/**
 * `driver_constructor_links` is keyed (season, driver, constructor), so a
 * driver who changes team mid-season could legitimately hold two rows. The
 * consumers do not expect that: models/drivers.model.ts and the frontend both
 * read a driver's team as a single value, and two rows would make a driver's
 * team non-deterministic.
 *
 * Resolution is the driver's MOST RECENT team that season — the highest round
 * they appear in. For 2025 that gives Tsunoda at Red Bull (not RB), Lawson at
 * RB (not Red Bull) and Colapinto at Alpine, which is what database/seed.sql
 * already records by hand.
 *
 * The per-result constructor is untouched: race_results.constructor_id stays
 * the team the driver actually drove for in THAT race.
 */
export function resolveDriverConstructorLinks(
  sightings: ReadonlyMap<string, DriverTeamSighting>,
  seasonId: string
): DriverConstructorLinkRow[] {
  return [...sightings.entries()]
    .map(([driverId, sighting]) => ({
      season_id: seasonId,
      driver_id: driverId,
      constructor_id: sighting.constructorId,
    }))
    .sort((a, b) => a.driver_id.localeCompare(b.driver_id));
}

// -- Plan -------------------------------------------------------------------

function upsertByKey<T>(target: Map<string, T>, key: string, value: T): void {
  target.set(key, value);
}

export interface BuildPlanInput {
  seasonId: string;
  /** Races carrying `Results`, from `{season}/results`. */
  raceResults: readonly JolpicaRace[];
  /** Races carrying `SprintResults`, from `{season}/sprint`. Optional. */
  sprintResults?: readonly JolpicaRace[];
  /** Rounds known to hold a sprint, from the season calendar. */
  sprintRounds?: ReadonlySet<number>;
}

/**
 * Folds the Jolpica payloads into the exact set of rows the database needs.
 * Deterministic and side-effect free, which is what makes the whole mapping
 * testable without a database or a network.
 */
export function buildSeasonIngestPlan(input: BuildPlanInput): SeasonIngestPlan {
  const { seasonId } = input;
  const warnings: string[] = [];

  const circuits = new Map<string, CircuitRow>();
  const grandPrix = new Map<string, GrandPrixRow>();
  const sessions = new Map<string, SessionRow>();
  const drivers = new Map<string, DriverRow>();
  const constructors = new Map<string, ConstructorRow>();
  const teamByDriver = new Map<string, DriverTeamSighting>();
  const raceResults: RaceResultRow[] = [];

  const sprintRounds = new Set<number>(input.sprintRounds ?? []);

  for (const race of input.sprintResults ?? []) {
    sprintRounds.add(race.round);
  }

  const seenDriverIds = new Map<string, string>();

  const ingestRace = (
    race: JolpicaRace,
    sessionType: IngestedSessionType
  ): void => {
    const grandPrixId = toGrandPrixId(seasonId, race.round);
    const results =
      (sessionType === "SPRINT" ? race.SprintResults : race.Results) ?? [];

    upsertByKey(circuits, race.Circuit.circuitId, toCircuitRow(race));
    upsertByKey(
      grandPrix,
      grandPrixId,
      toGrandPrixRow(race, seasonId, sprintRounds.has(race.round))
    );

    if (results.length === 0) {
      return;
    }

    const sessionId = toSessionId(grandPrixId, sessionType);

    // total_laps is the winner's lap count: the race distance actually run,
    // which is what a shortened race should report.
    const winnerLaps = results.find((r) => r.position === 1)?.laps ?? null;

    upsertByKey(sessions, sessionId, {
      session_id: sessionId,
      grand_prix_id: grandPrixId,
      type: sessionType,
      total_laps: winnerLaps,
    });

    for (const result of results) {
      const driverId = toDriverId(result.Driver);
      const constructorRow = toConstructorRow(result.Constructor);

      const collidedWith = seenDriverIds.get(driverId);

      if (collidedWith !== undefined && collidedWith !== result.Driver.driverId) {
        warnings.push(
          `driver_id '${driverId}' maps from two Jolpica drivers ` +
            `('${collidedWith}' and '${result.Driver.driverId}') — rows will overwrite each other`
        );
      }

      seenDriverIds.set(driverId, result.Driver.driverId);

      upsertByKey(drivers, driverId, toDriverRow(result.Driver, result.number));
      upsertByKey(constructors, constructorRow.constructor_id, constructorRow);

      // Keep the highest round seen for this driver, across race and sprint
      // sessions alike.
      const existing = teamByDriver.get(driverId);

      if (existing === undefined || race.round >= existing.round) {
        teamByDriver.set(driverId, {
          round: race.round,
          constructorId: constructorRow.constructor_id,
        });
      }
    }

    raceResults.push(...toRaceResultRows(race, seasonId, sessionType));
  };

  for (const race of input.raceResults) {
    ingestRace(race, "RACE");
  }

  for (const race of input.sprintResults ?? []) {
    ingestRace(race, "SPRINT");
  }

  const year = Number(seasonId);

  if (!Number.isInteger(year)) {
    throw new Error(`Season must be a four-digit year, received '${seasonId}'`);
  }

  return {
    season: { season_id: seasonId, year },
    circuits: [...circuits.values()].sort((a, b) =>
      a.circuit_id.localeCompare(b.circuit_id)
    ),
    grandPrix: [...grandPrix.values()].sort((a, b) => a.round - b.round),
    sessions: [...sessions.values()].sort((a, b) =>
      a.session_id.localeCompare(b.session_id)
    ),
    drivers: [...drivers.values()].sort((a, b) =>
      a.driver_id.localeCompare(b.driver_id)
    ),
    constructors: [...constructors.values()].sort((a, b) =>
      a.constructor_id.localeCompare(b.constructor_id)
    ),
    driverConstructorLinks: resolveDriverConstructorLinks(
      teamByDriver,
      seasonId
    ),
    raceResults,
    warnings,
  };
}
