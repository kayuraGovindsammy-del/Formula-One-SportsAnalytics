import { getPool } from "../config/database.js";
import type { Session, SessionType } from "../types/session.types.js";

interface SessionSqlRow {
  session_id: string;
  grand_prix_id: string;
  type: SessionType;
  total_laps: number | null;
  start_time: Date | string | null;
  end_time: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSession(row: SessionSqlRow): Session {
  return {
    session_id: row.session_id,
    grand_prix_id: row.grand_prix_id,
    type: row.type,
    total_laps: row.total_laps,
    start_time: iso(row.start_time),
    end_time: iso(row.end_time),
  };
}

export async function findByRace(grandPrixId: string): Promise<Session[]> {
  const result = await getPool().query<SessionSqlRow>(
    `
      SELECT session_id, grand_prix_id, type, total_laps, start_time, end_time
      FROM sessions
      WHERE LOWER(grand_prix_id) = LOWER($1)
      ORDER BY
        CASE type
          WHEN 'PRACTICE_1' THEN 1
          WHEN 'PRACTICE_2' THEN 2
          WHEN 'PRACTICE_3' THEN 3
          WHEN 'SPRINT_QUALIFYING' THEN 4
          WHEN 'SPRINT' THEN 5
          WHEN 'QUALIFYING' THEN 6
          WHEN 'RACE' THEN 7
          ELSE 99
        END,
        session_id
    `,
    [grandPrixId]
  );

  return result.rows.map(toSession);
}

export async function findBySeason(season: string): Promise<Session[]> {
  const result = await getPool().query<SessionSqlRow>(
    `
      SELECT s.session_id, s.grand_prix_id, s.type, s.total_laps,
             s.start_time, s.end_time
      FROM sessions s
      JOIN grand_prix gp
        ON gp.grand_prix_id = s.grand_prix_id
      WHERE gp.season_id = $1
      ORDER BY gp.round, s.session_id
    `,
    [season]
  );

  return result.rows.map(toSession);
}

export async function findOneByRaceAndType(
  grandPrixId: string,
  type: SessionType
): Promise<Session | null> {
  const result = await getPool().query<SessionSqlRow>(
    `
      SELECT session_id, grand_prix_id, type, total_laps, start_time, end_time
      FROM sessions
      WHERE LOWER(grand_prix_id) = LOWER($1)
        AND type = $2
      LIMIT 1
    `,
    [grandPrixId, type]
  );

  const row = result.rows[0];
  return row ? toSession(row) : null;
}
