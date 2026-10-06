// ---------------------------------------------------------------------------
// A fake pg.Pool that records every query it is asked to run.
//
// Unlike src/test/sampleModelMocks.ts, which substitutes the model layer, this
// substitutes the *pool* — so the real SQL in src/models/ still executes its
// real code path and every `getPool().query(...)` is counted. That is what
// makes it usable as a regression guard on query volume
// (src/routes/driverStats.queryCount.test.ts).
//
// Rows are synthesised from the existing data/sample fixtures, replicated
// across a full season's worth of sessions, so a request under this pool does
// real work rather than short-circuiting on empty results.
// ---------------------------------------------------------------------------

import {
  rawDrivers,
  rawEvents,
  rawLaps,
  rawRaces,
  rawSessionResult,
  seasonId,
  toGrandPrixId,
} from "../models/sampleData.js";
import { pointsForPosition } from "../services/pointsTable.js";

export interface QueryCall {
  sql: string;
  values: readonly unknown[];
}

/** Every query issued since the last resetQueryCalls(). */
export const queryCalls: QueryCall[] = [];

export function resetQueryCalls(): void {
  queryCalls.length = 0;
}

/** The season the fixture pool serves, and how many races are in it. */
export const fixtureSeason = seasonId;
export const fixtureRaceCount = rawRaces.length;

function raceSessionId(grandPrixId: string): string {
  return `${grandPrixId}_RACE`;
}

function qualifyingSessionId(grandPrixId: string): string {
  return `${grandPrixId}_QUALIFYING`;
}

/** Every session in the fixture season: one RACE + one QUALIFYING per round. */
function seasonSessionRows(values: readonly unknown[]): unknown[] {
  if (values[0] !== seasonId) return [];

  return rawRaces.flatMap((race) => {
    const grandPrixId = toGrandPrixId(seasonId, race.round);

    return [
      {
        session_id: raceSessionId(grandPrixId),
        grand_prix_id: grandPrixId,
        type: "RACE",
        total_laps: null,
        start_time: null,
        end_time: null,
      },
      {
        session_id: qualifyingSessionId(grandPrixId),
        grand_prix_id: grandPrixId,
        type: "QUALIFYING",
        total_laps: null,
        start_time: null,
        end_time: null,
      },
    ];
  });
}

/**
 * Accepts either a scalar session_id (the per-session queries) or an array of
 * them (the batched `= ANY($1)` queries), so the same fixture serves both
 * loading strategies.
 */
function requestedSessionIds(values: readonly unknown[]): string[] {
  const first = values[0];

  if (Array.isArray(first)) {
    return first.filter((value): value is string => typeof value === "string");
  }

  return typeof first === "string" ? [first] : [];
}

function driverRows(values: readonly unknown[]): unknown[] {
  const wanted = values[0];
  if (typeof wanted !== "string") return [];

  return rawDrivers
    .filter((driver) => driver.driver_id.toLowerCase() === wanted.toLowerCase())
    .map((driver) => ({
      driver_id: driver.driver_id,
      permanent_number: driver.permanent_number,
      given_name: driver.given_name,
      family_name: driver.family_name,
      nationality: driver.nationality,
      date_of_birth: driver.date_of_birth,
      constructor_id: driver.constructor_id,
      constructor_name: driver.constructor_id,
    }));
}

function lapRows(values: readonly unknown[]): unknown[] {
  return requestedSessionIds(values).flatMap((sessionId) =>
    rawLaps.map((lap) => ({
      session_id: sessionId,
      driver_id: lap.driver_id,
      lap_number: lap.lap_number,
      lap_time_ms: lap.lap_time_ms,
      position: lap.position,
      is_pit_lap: lap.is_pit_lap,
      is_valid: lap.is_valid,
    }))
  );
}

function eventRows(values: readonly unknown[]): unknown[] {
  return requestedSessionIds(values).flatMap((sessionId) =>
    rawEvents.map((event) => ({
      event_id: `${sessionId}:${event.event_id}`,
      session_id: sessionId,
      driver_id: event.driver_id ?? null,
      type: event.type,
      lap_number: event.lap_number ?? null,
      timestamp: event.timestamp ?? null,
      payload: event.payload,
    }))
  );
}

function raceResultRows(values: readonly unknown[]): unknown[] {
  return requestedSessionIds(values).flatMap((sessionId) =>
    rawSessionResult.classification.map((result) => ({
      session_id: sessionId,
      position: result.position,
      driver_id: result.driver_id,
      constructor_id: result.constructor_id,
      laps_completed: result.laps,
      pit_stops: result.pit_stops,
      gap_to_winner_ms: result.gap_to_winner_ms,
      // Ingested fastest-lap metadata is present, matching a Jolpica-ingested
      // race. Pinned to the winner rather than to the sample data's real
      // fastest-lap driver, who has no classification row: without a rank-1
      // row the per-race loader falls back to an extra laps query, and the
      // query count would then depend on the fixture rather than on the
      // loading strategy under test.
      fastest_lap_rank: result.position === 1 ? 1 : null,
      fastest_lap_number:
        result.position === 1 ? rawSessionResult.fastest_lap.lap_number : null,
      fastest_lap_time_ms:
        result.position === 1 ? rawSessionResult.fastest_lap.time_ms : null,
      // NUMERIC comes back from node-postgres as a string.
      points: String(pointsForPosition(result.position)),
      status: "FINISHED",
    }))
  );
}

function raceSessionLookupRows(values: readonly unknown[]): unknown[] {
  const grandPrixId = values[0];
  if (typeof grandPrixId !== "string") return [];

  return [{ session_id: raceSessionId(grandPrixId) }];
}

// Dispatch is by SQL shape. Order matters: the event-log UNION also mentions
// `FROM laps`, and the season-sessions query also mentions `FROM sessions`.
/** names.model.ts's directory query: every driver's full name. */
function nameRows(): unknown[] {
  return rawDrivers.map((driver) => ({
    kind: "driver",
    id: driver.driver_id,
    name: `${driver.given_name} ${driver.family_name}`,
  }));
}

function rowsFor(sql: string, values: readonly unknown[]): unknown[] {
  if (sql.includes("AS kind")) return nameRows();
  if (sql.includes("FROM drivers d")) return driverRows(values);
  if (sql.includes("JOIN grand_prix gp")) return seasonSessionRows(values);
  if (sql.includes("WITH event_log AS")) return eventRows(values);
  if (sql.includes("FROM race_results")) return raceResultRows(values);
  if (sql.includes("ORDER BY lap_time_ms")) return [];
  if (sql.includes("FROM laps")) return lapRows(values);
  if (sql.includes("FROM sessions")) return raceSessionLookupRows(values);

  throw new Error(`countingPool has no fixture for this SQL:\n${sql}`);
}

/**
 * Stands in for pg.Pool. Only `query` is implemented, because that is all the
 * model layer uses.
 */
export function createCountingPool(): {
  query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: never[] }>;
} {
  return {
    query(sql: string, values: readonly unknown[] = []) {
      queryCalls.push({ sql, values });

      return Promise.resolve({ rows: rowsFor(sql, values) as never[] });
    },
  };
}
