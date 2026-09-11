import { getPool } from "../config/database.js";

export interface RaceResultRow {
  position: number;
  driver_id: string;
  constructor_id: string;
  laps: number;
  pit_stops: number;
  gap_to_winner_ms: number | null;
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
        fastest_lap_time_ms
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
    })),
  };
}
