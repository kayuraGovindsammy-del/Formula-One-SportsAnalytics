import { getPool } from "../config/database.js";

export interface QualifyingClassificationRow {
  position: number;
  driver_id: string;
  given_name: string;
  family_name: string;
  constructor_id: string;
  constructor_name: string;
  q1_time_ms: number | null;
  q2_time_ms: number | null;
  q3_time_ms: number | null;
}

export interface QualifyingData {
  session_id: string | null;
  classification: QualifyingClassificationRow[];
}

export async function findByRace(grandPrixId: string): Promise<QualifyingData> {
  const session = await getPool().query<{ session_id: string }>(
    `SELECT session_id
     FROM sessions
     WHERE LOWER(grand_prix_id) = LOWER($1)
       AND type = 'QUALIFYING'
     LIMIT 1`,
    [grandPrixId]
  );

  const sessionId = session.rows[0]?.session_id ?? null;
  if (sessionId === null) {
    return { session_id: null, classification: [] };
  }

  const results = await getPool().query<QualifyingClassificationRow>(
    `SELECT
       qr.position,
       qr.driver_id,
       d.given_name,
       d.family_name,
       qr.constructor_id,
       c.name AS constructor_name,
       qr.q1_time_ms,
       qr.q2_time_ms,
       qr.q3_time_ms
     FROM qualifying_results qr
     JOIN drivers d ON d.driver_id = qr.driver_id
     JOIN constructors c ON c.constructor_id = qr.constructor_id
     WHERE qr.session_id = $1
     ORDER BY qr.position, qr.driver_id`,
    [sessionId]
  );

  return { session_id: sessionId, classification: results.rows };
}
