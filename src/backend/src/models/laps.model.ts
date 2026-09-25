import { getPool } from "../config/database.js";
import * as racesModel from "./races.model.js";
import * as sessionsModel from "./sessions.model.js";
import type { PageOptions } from "../utils/pagination.js";
import type { Lap } from "../types/lap.types.js";
import type { SessionType } from "../types/session.types.js";

export interface LapFilters {
  driver_id?: string | undefined;
  session_type: SessionType;
}

export type FindLapsOptions = LapFilters & PageOptions;

export interface LapPage {
  rows: Lap[];
  total_items: number;
}

interface LapSqlRow extends Lap {
  total_items?: number;
}

function offset(options: PageOptions): number {
  return (options.page - 1) * options.per_page;
}

/**
 * Every persisted lap in a session, unpaginated.
 *
 * Accepted LAP_COMPLETED submissions are inserted into this same `laps` table
 * during admin approval, so the statistics layer sees them automatically.
 */
export async function findAllBySession(sessionId: string): Promise<Lap[]> {
  const result = await getPool().query<Lap>(
    `
      SELECT
        session_id,
        driver_id,
        lap_number,
        lap_time_ms,
        position,
        is_pit_lap,
        is_valid
      FROM laps
      WHERE session_id = $1
      ORDER BY driver_id, lap_number
    `,
    [sessionId]
  );

  return result.rows;
}

/**
 * The same rows as findAllBySession, for many sessions at once, in a single
 * query — grouped by session_id.
 *
 * Callers that walk a whole season (controllers/drivers.controller.ts) use
 * this instead of one findAllBySession per race, so query volume stays flat
 * as the calendar grows. Sessions with no persisted laps are simply absent
 * from the map; laps within each session keep findAllBySession's ordering.
 */
export async function findAllBySessions(
  sessionIds: readonly string[]
): Promise<Map<string, Lap[]>> {
  const bySession = new Map<string, Lap[]>();

  if (sessionIds.length === 0) return bySession;

  const result = await getPool().query<Lap>(
    `
      SELECT
        session_id,
        driver_id,
        lap_number,
        lap_time_ms,
        position,
        is_pit_lap,
        is_valid
      FROM laps
      WHERE session_id = ANY($1::varchar[])
      ORDER BY session_id, driver_id, lap_number
    `,
    [sessionIds]
  );

  for (const row of result.rows) {
    const existing = bySession.get(row.session_id);

    if (existing === undefined) {
      bySession.set(row.session_id, [row]);
    } else {
      existing.push(row);
    }
  }

  return bySession;
}

/**
 * Returns null only when the race itself does not exist.
 * An existing race/session with no persisted laps returns an empty page.
 */
export async function findByRace(
  grandPrixId: string,
  options: FindLapsOptions
): Promise<LapPage | null> {
  if (!(await racesModel.exists(grandPrixId))) return null;

  const session = await sessionsModel.findOneByRaceAndType(
    grandPrixId,
    options.session_type
  );

  if (!session) return { rows: [], total_items: 0 };

  const values: unknown[] = [session.session_id];
  const where = ["session_id = $1"];

  if (options.driver_id !== undefined) {
    values.push(options.driver_id);
    where.push(`LOWER(driver_id) = LOWER($${values.length})`);
  }

  values.push(options.per_page);
  const limitParam = `$${values.length}`;

  values.push(offset(options));
  const offsetParam = `$${values.length}`;

  const result = await getPool().query<LapSqlRow>(
    `
      SELECT
        session_id,
        driver_id,
        lap_number,
        lap_time_ms,
        position,
        is_pit_lap,
        is_valid,
        COUNT(*) OVER()::int AS total_items
      FROM laps
      WHERE ${where.join(" AND ")}
      ORDER BY driver_id, lap_number
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  return {
    rows: result.rows.map(({ total_items: _count, ...row }) => row),
    total_items: result.rows[0]?.total_items ?? 0,
  };
}
