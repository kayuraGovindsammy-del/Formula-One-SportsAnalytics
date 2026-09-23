import {
  rawDrivers,
  rawEvents,
  rawLaps,
  lapsSessionId,
  rawRaces,
  rawSessionResult,
  rawSessionSummary,
  seasonId,
  toGrandPrixId,
  type RawDriver,
  type RawRace,
  type RawEvent,
  type RawLap,
} from "../models/sampleData.js";
import { pointsForPosition } from "../services/pointsTable.js";
import { paginate, type PageOptions } from "../utils/pagination.js";
import type { DriverRecord } from "../types/driver.types.js";
import type { Race, RaceDetail, RaceListItem } from "../types/race.types.js";
import type { Session, SessionType } from "../types/session.types.js";
import type { Event, EventPayload, EventType } from "../types/event.types.js";
import type { Lap } from "../types/lap.types.js";

const CONSTRUCTOR_NAMES: Readonly<Record<string, string>> = {
  RBR: "Red Bull Racing",
  MCL: "McLaren",
  FER: "Ferrari",
  MER: "Mercedes",
  AMR: "Aston Martin",
  WIL: "Williams",
  RB: "Racing Bulls",
  HAA: "Haas F1 Team",
  ALP: "Alpine",
  SAU: "Kick Sauber",
};

export interface DriverOptions extends PageOptions {
  constructor_id?: string | undefined;
  nationality?: string | undefined;
  search?: string | undefined;
}

export interface RaceOptions extends PageOptions {
  season?: string | undefined;
  has_sprint?: boolean | undefined;
  search?: string | undefined;
}

function toDriver(raw: RawDriver): DriverRecord {
  return {
    driver_id: raw.driver_id,
    permanent_number: raw.permanent_number,
    given_name: raw.given_name,
    family_name: raw.family_name,
    nationality: raw.nationality,
    date_of_birth: raw.date_of_birth,
    constructor_id: raw.constructor_id,
    constructor_name: CONSTRUCTOR_NAMES[raw.constructor_id] ?? raw.constructor_id,
  };
}

function driverMatches(raw: RawDriver, options: DriverOptions): boolean {
  if (
    options.constructor_id !== undefined &&
    raw.constructor_id.toLowerCase() !== options.constructor_id.toLowerCase()
  ) return false;

  if (
    options.nationality !== undefined &&
    raw.nationality.toLowerCase() !== options.nationality.toLowerCase()
  ) return false;

  if (options.search !== undefined) {
    const needle = options.search.toLowerCase();
    const fullName = `${raw.given_name} ${raw.family_name}`.toLowerCase();
    if (
      !raw.given_name.toLowerCase().includes(needle) &&
      !raw.family_name.toLowerCase().includes(needle) &&
      !fullName.includes(needle)
    ) return false;
  }

  return true;
}

export async function findAllDrivers(options: DriverOptions) {
  const matched = rawDrivers.filter((raw) => driverMatches(raw, options));
  return {
    rows: paginate(matched, options).map(toDriver),
    total_items: matched.length,
  };
}

export async function findDriverById(driverId: string) {
  const raw = rawDrivers.find(
    (candidate) => candidate.driver_id.toLowerCase() === driverId.toLowerCase()
  );
  return raw ? toDriver(raw) : null;
}

export async function getConstructorIdByDriver(): Promise<Record<string, string>> {
  return Object.fromEntries(
    rawDrivers.map((driver) => [driver.driver_id, driver.constructor_id])
  );
}

export async function findConstructorById(constructorId: string) {
  const name = CONSTRUCTOR_NAMES[constructorId.toUpperCase()];
  if (name === undefined) return null;

  return {
    constructor_id: constructorId.toUpperCase(),
    name,
    nationality: "",
  };
}

export async function findDriverIdsBySeason(
  constructorId: string,
  season: string
): Promise<string[]> {
  if (season !== seasonId) return [];

  return rawDrivers
    .filter(
      (driver) => driver.constructor_id.toLowerCase() === constructorId.toLowerCase()
    )
    .map((driver) => driver.driver_id)
    .sort();
}

function buildSampleSession(): Session {
  return {
    session_id: rawSessionSummary.session_id,
    grand_prix_id: toGrandPrixId(seasonId, rawSessionSummary.round),
    type: rawSessionSummary.type as SessionType,
    total_laps: rawSessionSummary.total_laps ?? null,
    start_time: "2025-07-27T13:00:00Z",
    end_time: "2025-07-27T14:30:00Z",
  };
}

const sampleSession = buildSampleSession();

export async function findSessionsByRace(grandPrixId: string): Promise<Session[]> {
  return sampleSession.grand_prix_id.toLowerCase() === grandPrixId.toLowerCase()
    ? [sampleSession]
    : [];
}

export async function findSessionsBySeason(season: string): Promise<Session[]> {
  if (!sampleSession.grand_prix_id.startsWith(`${season}_`)) return [];

  return [
    sampleSession,
    {
      ...sampleSession,
      session_id: `${sampleSession.grand_prix_id}_QUALIFYING`,
      type: "QUALIFYING",
      total_laps: null,
    },
  ];
}

export async function findOneSessionByRaceAndType(
  grandPrixId: string,
  type: SessionType
): Promise<Session | null> {
  const sessions = await findSessionsByRace(grandPrixId);
  return sessions.find((session) => session.type === type) ?? null;
}

function toRace(raw: RawRace): Race {
  return {
    grand_prix_id: toGrandPrixId(seasonId, raw.round),
    season_id: seasonId,
    round: raw.round,
    race_name: raw.race_name,
    circuit_id: raw.circuit_id,
    circuit_name: raw.circuit_name,
    locality: raw.locality,
    country: raw.country,
    date: raw.date,
    has_sprint: raw.has_sprint,
  };
}

function raceMatches(raw: RawRace, options: RaceOptions): boolean {
  if (options.season !== undefined && options.season !== seasonId) return false;
  if (options.has_sprint !== undefined && raw.has_sprint !== options.has_sprint)
    return false;

  if (options.search !== undefined) {
    const needle = options.search.toLowerCase();
    if (
      !raw.race_name.toLowerCase().includes(needle) &&
      !raw.country.toLowerCase().includes(needle) &&
      !raw.circuit_name.toLowerCase().includes(needle)
    ) return false;
  }

  return true;
}

export async function findAllRaces(options: RaceOptions) {
  const matched = rawRaces.filter((raw) => raceMatches(raw, options));
  const page = paginate(matched, options);

  const rows: RaceListItem[] = await Promise.all(
    page.map(async (raw) => {
      const race = toRace(raw);
      return {
        ...race,
        has_results: (await findSessionsByRace(race.grand_prix_id)).length > 0,
      };
    })
  );

  return { rows, total_items: matched.length };
}

export async function findRaceById(grandPrixId: string): Promise<RaceDetail | null> {
  const raw = rawRaces.find(
    (candidate) =>
      toGrandPrixId(seasonId, candidate.round).toLowerCase() ===
      grandPrixId.toLowerCase()
  );

  if (!raw) return null;
  const race = toRace(raw);
  return {
    ...race,
    sessions: await findSessionsByRace(race.grand_prix_id),
  };
}

export async function raceExists(grandPrixId: string): Promise<boolean> {
  return rawRaces.some(
    (candidate) =>
      toGrandPrixId(seasonId, candidate.round).toLowerCase() ===
      grandPrixId.toLowerCase()
  );
}

export async function findRaceResults(grandPrixId: string) {
  const sampleGrandPrixId = toGrandPrixId(seasonId, rawSessionSummary.round);
  if (sampleGrandPrixId.toLowerCase() !== grandPrixId.toLowerCase()) return null;

  return {
    fastest_lap: {
      driver_id: rawSessionResult.fastest_lap.driver_id,
      lap_number: rawSessionResult.fastest_lap.lap_number,
      time_ms: rawSessionResult.fastest_lap.time_ms,
    },
    classification: rawSessionResult.classification.map((result) => ({
      position: result.position,
      driver_id: result.driver_id,
      constructor_id: result.constructor_id,
      laps: result.laps,
      pit_stops: result.pit_stops,
      gap_to_winner_ms: result.gap_to_winner_ms,
      // The sample data has no real ingested points column to read (unlike
      // production race_results), so this fixture stands in with the same
      // base-scale value the derivation would produce — existing
      // driver-stats expectations stay correct either way, and
      // driverStatistics.test.ts covers a stored value that actually
      // disagrees with the derived one.
      points: pointsForPosition(result.position),
    })),
  };
}


function toFixtureLap(raw: RawLap, sessionId: string): Lap {
  return {
    session_id: sessionId,
    driver_id: raw.driver_id,
    lap_number: raw.lap_number,
    position: raw.position,
    lap_time_ms: raw.lap_time_ms,
    is_pit_lap: raw.is_pit_lap,
    is_valid: raw.is_valid,
  };
}

export async function findAllLapsBySession(sessionId: string): Promise<Lap[]> {
  if (sessionId !== lapsSessionId) return [];
  return [...rawLaps]
    .sort(
      (a, b) =>
        a.driver_id.localeCompare(b.driver_id) || a.lap_number - b.lap_number
    )
    .map((raw) => toFixtureLap(raw, sessionId));
}

export async function findLapsByRace(
  grandPrixId: string,
  options: {
    driver_id?: string;
    session_type: SessionType;
    page: number;
    per_page: number;
  }
) {
  if (!(await raceExists(grandPrixId))) return null;
  const session = await findOneSessionByRaceAndType(grandPrixId, options.session_type);
  if (!session || session.session_id !== lapsSessionId)
    return { rows: [], total_items: 0 };

  const matched = rawLaps
    .filter(
      (raw) =>
        options.driver_id === undefined ||
        raw.driver_id.toLowerCase() === options.driver_id.toLowerCase()
    )
    .sort(
      (a, b) =>
        a.driver_id.localeCompare(b.driver_id) || a.lap_number - b.lap_number
    );

  const start = (options.page - 1) * options.per_page;
  return {
    rows: matched
      .slice(start, start + options.per_page)
      .map((raw) => toFixtureLap(raw, session.session_id)),
    total_items: matched.length,
  };
}

function toFixtureEvent(raw: RawEvent): Event {
  return {
    event_id: raw.event_id,
    session_id: raw.session_id,
    ...(raw.driver_id !== undefined ? { driver_id: raw.driver_id } : {}),
    type: raw.type as EventType,
    ...(raw.lap_number !== undefined ? { lap_number: raw.lap_number } : {}),
    timestamp: raw.timestamp ?? null,
    payload: raw.payload as EventPayload,
  };
}

export async function findAllEventsBySession(sessionId: string): Promise<Event[]> {
  return rawEvents
    .filter((raw) => raw.session_id === sessionId)
    .sort((a, b) => a.event_id.localeCompare(b.event_id))
    .map(toFixtureEvent);
}

export async function findEventsByRace(
  grandPrixId: string,
  options: {
    driver_id?: string;
    type?: EventType;
    session_type: SessionType;
    page: number;
    per_page: number;
  }
) {
  if (!(await raceExists(grandPrixId))) return null;
  const session = await findOneSessionByRaceAndType(grandPrixId, options.session_type);
  if (!session) return { rows: [], total_items: 0 };

  const matched = rawEvents
    .filter((raw) => {
      if (raw.session_id !== session.session_id) return false;
      if (options.type !== undefined && raw.type !== options.type) return false;
      if (
        options.driver_id !== undefined &&
        raw.driver_id?.toLowerCase() !== options.driver_id.toLowerCase()
      ) return false;
      return true;
    })
    .sort((a, b) => a.event_id.localeCompare(b.event_id));

  const start = (options.page - 1) * options.per_page;
  return {
    rows: matched
      .slice(start, start + options.per_page)
      .map(toFixtureEvent),
    total_items: matched.length,
  };
}
