import { getPool } from "../config/database.js";

/** Mirrors the `result_status` enum in database/schema.sql. */
export type RaceResultStatus = "FINISHED" | "DNF" | "DSQ";

export interface RaceResultRow {
  position: number;
  driver_id: string;
  constructor_id: string;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number | null;
  /**
   * Written straight from Jolpica — a published fact, not a derived
   * statistic (docs/ingestion/jolpica-ingestion.md §4.2). Consumers that
   * prefer a derivation (e.g. race classification) should keep doing so;
   * this exists for consumers like driverStatistics.ts that specifically
   * want the ingested value.
   */
  points: number;
  status: RaceResultStatus;
}

export interface FastestLapData {
  driver_id: string;
  lap_number: number;
  time_ms: number;
}

export interface RaceResultData {
  fastest_lap: FastestLapData | null;
  classification: RaceResultRow[];
}

interface RaceResultSqlRow {
  position: number | null;
  driver_id: string;
  constructor_id: string;
  laps_completed: number;
  pit_stops: number;
  gap_to_winner_ms: number | null;
  fastest_lap_rank: number | null;
  fastest_lap_number: number | null;
  fastest_lap_time_ms: number | null;
  // `points` is NUMERIC(6,2) in schema.sql. node-postgres returns NUMERIC as
  // a string (no OID 1700 type parser is registered), so this is read and
  // converted with Number() below rather than trusted as a number here.
  points: string;
  status: RaceResultStatus;
}

/**
 * The classification rows for many RACE sessions at once, in a single query,
 * grouped by session_id.
 *
 * Deliberately narrower than findByRace: it returns classifications only, and
 * keys off session_id rather than resolving a grand prix to its race session.
 * Callers that walk a whole season (controllers/drivers.controller.ts) already
 * hold the session ids and want nothing but each driver's ingested
 * `points`, so both of findByRace's other queries — the grand-prix-to-session
 * lookup and the fastest-lap fallback over `laps` — would be pure overhead
 * per race. Consumers that need `fastest_lap` should keep using findByRace.
 *
 * Sessions with no ingested result are simply absent from the map, which is
 * the batched equivalent of findByRace returning null for them.
 */
export async function findClassificationsBySessions(
  sessionIds: readonly string[]
): Promise<Map<string, RaceResultRow[]>> {
  const bySession = new Map<string, RaceResultRow[]>();

  if (sessionIds.length === 0) return bySession;

  const results = await getPool().query<RaceResultSqlRow & { session_id: string }>(
    `
      SELECT
        session_id,
        position,
        driver_id,
        constructor_id,
        laps_completed,
        pit_stops,
        gap_to_winner_ms,
        fastest_lap_rank,
        fastest_lap_number,
        fastest_lap_time_ms,
        points,
        status
      FROM race_results
      WHERE session_id = ANY($1::varchar[])
      ORDER BY session_id, position NULLS LAST, driver_id
    `,
    [sessionIds]
  );

  for (const row of results.rows) {
    const existing = bySession.get(row.session_id);
    const rows = existing ?? [];

    if (existing === undefined) {
      bySession.set(row.session_id, rows);
    }

    // Same positional fallback as findByRace, applied within each session's
    // own ordered block rather than across the whole result set.
    rows.push({
      position: row.position ?? rows.length + 1,
      driver_id: row.driver_id,
      constructor_id: row.constructor_id,
      laps: row.laps_completed,
      pit_stops: row.pit_stops,
      gap_to_winner_ms: row.gap_to_winner_ms,
      points: Number(row.points),
      status: row.status,
    });
  }

  return bySession;
}

export async function findByRace(
  grandPrixId: string
): Promise<RaceResultData | null> {
  const raceSession = await getPool().query<{ session_id: string }>(
    `
      SELECT session_id
      FROM sessions
      WHERE LOWER(grand_prix_id) = LOWER($1)
        AND type = 'RACE'
      LIMIT 1
    `,
    [grandPrixId]
  );

  const sessionId = raceSession.rows[0]?.session_id;
  if (!sessionId) return null;

  const results = await getPool().query<RaceResultSqlRow>(
    `
      SELECT
        position,
        driver_id,
        constructor_id,
        laps_completed,
        pit_stops,
        gap_to_winner_ms,
        fastest_lap_rank,
        fastest_lap_number,
        fastest_lap_time_ms,
        points,
        status
      FROM race_results
      WHERE session_id = $1
      ORDER BY position NULLS LAST, driver_id
    `,
    [sessionId]
  );

  if (results.rows.length === 0) return null;

  const storedFastest = results.rows.find(
    (row) =>
      row.fastest_lap_rank === 1 &&
      row.fastest_lap_number !== null &&
      row.fastest_lap_time_ms !== null
  );

  let fastestLap: FastestLapData | null = null;

  if (
    storedFastest &&
    storedFastest.fastest_lap_number !== null &&
    storedFastest.fastest_lap_time_ms !== null
  ) {
    fastestLap = {
      driver_id: storedFastest.driver_id,
      lap_number: storedFastest.fastest_lap_number,
      time_ms: storedFastest.fastest_lap_time_ms,
    };
  }

  if (fastestLap === null) {
    const fastest = await getPool().query<FastestLapData>(
      `
        SELECT
          driver_id,
          lap_number,
          lap_time_ms AS time_ms
        FROM laps
        WHERE session_id = $1
          AND is_valid = TRUE
          AND lap_time_ms IS NOT NULL
        ORDER BY lap_time_ms ASC, lap_number ASC, driver_id
        LIMIT 1
      `,
      [sessionId]
    );

    fastestLap = fastest.rows[0] ?? null;
  }

  return {
    fastest_lap: fastestLap,
    classification: results.rows.map((row, index) => ({
      position: row.position ?? index + 1,
      driver_id: row.driver_id,
      constructor_id: row.constructor_id,
      laps: row.laps_completed,
      pit_stops: row.pit_stops,
      gap_to_winner_ms: row.gap_to_winner_ms,
      points: Number(row.points),
      status: row.status,
    })),
  };
}
