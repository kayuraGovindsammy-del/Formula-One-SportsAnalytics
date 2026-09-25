import { getPool } from "../config/database.js";
import * as racesModel from "./races.model.js";
import * as sessionsModel from "./sessions.model.js";
import type { PageOptions } from "../utils/pagination.js";
import type { Event, EventPayload, EventType } from "../types/event.types.js";
import type { SessionType } from "../types/session.types.js";

export interface EventFilters {
  driver_id?: string | undefined;
  type?: EventType | undefined;
  session_type: SessionType;
}

export type FindEventsOptions = EventFilters & PageOptions;

export interface EventPage {
  rows: Event[];
  total_items: number;
}

interface EventSqlRow {
  event_id: string;
  session_id: string;
  driver_id: string | null;
  type: EventType;
  lap_number: number | null;
  timestamp: Date | string | null;
  payload: EventPayload;
  total_items?: number;
}

function offset(options: PageOptions): number {
  return (options.page - 1) * options.per_page;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toEvent(row: EventSqlRow): Event {
  return {
    event_id: row.event_id,
    session_id: row.session_id,
    ...(row.driver_id !== null ? { driver_id: row.driver_id } : {}),
    type: row.type,
    ...(row.lap_number !== null ? { lap_number: row.lap_number } : {}),
    timestamp: toIso(row.timestamp),
    payload: row.payload,
  };
}

/**
 * Reassembles the public event log from PostgreSQL.
 *
 * - Accepted submissions come from `accepted_events`, which preserves the exact
 *   validated event envelope.
 * - Legacy normalized rows whose submission_id is NULL are included so data
 *   that predates the submission workflow is not silently lost.
 * - Normalized rows created from accepted submissions are NOT re-added, because
 *   their exact envelope already exists in accepted_events.
 */
async function querySessionEvents(
  sessionIds: readonly string[],
  driverId?: string,
  type?: EventType,
  page?: PageOptions
): Promise<{ rows: Event[]; total_items: number }> {
  const values: unknown[] = [sessionIds];
  const filters: string[] = [];

  if (driverId !== undefined) {
    values.push(driverId);
    filters.push(`LOWER(driver_id) = LOWER($${values.length})`);
  }

  if (type !== undefined) {
    values.push(type);
    filters.push(`type = $${values.length}::text`);
  }

  let pagingSql = "";
  if (page) {
    values.push(page.per_page);
    const limitParam = `$${values.length}`;
    values.push(offset(page));
    const offsetParam = `$${values.length}`;
    pagingSql = `LIMIT ${limitParam} OFFSET ${offsetParam}`;
  }

  const result = await getPool().query<EventSqlRow>(
    `
      WITH event_log AS (
        SELECT
          ae.event_id,
          ae.session_id,
          NULLIF(ae.event_data->>'driver_id', '') AS driver_id,
          ae.event_data->>'type' AS type,
          CASE
            WHEN ae.event_data ? 'lap_number'
              THEN (ae.event_data->>'lap_number')::int
            ELSE NULL
          END AS lap_number,
          NULLIF(ae.event_data->>'timestamp', '')::timestamptz AS timestamp,
          COALESCE(ae.event_data->'payload', '{}'::jsonb) AS payload
        FROM accepted_events ae
        WHERE ae.session_id = ANY($1::varchar[])

        UNION ALL

        SELECT
          'legacy_lap:' || l.session_id || ':' || l.driver_id || ':' || l.lap_number,
          l.session_id,
          l.driver_id,
          'LAP_COMPLETED',
          l.lap_number,
          NULL::timestamptz,
          jsonb_build_object(
            'lap_time_ms', l.lap_time_ms,
            'position', l.position,
            'is_pit_lap', l.is_pit_lap,
            'is_valid', l.is_valid
          )
        FROM laps l
        WHERE l.session_id = ANY($1::varchar[])
          AND l.submission_id IS NULL

        UNION ALL

        SELECT
          'legacy_pit:' || p.pit_stop_id,
          p.session_id,
          p.driver_id,
          'PIT_STOP',
          p.lap_number,
          NULL::timestamptz,
          jsonb_build_object('duration_ms', p.duration_ms)
        FROM pit_stops p
        WHERE p.session_id = ANY($1::varchar[])
          AND p.submission_id IS NULL

        UNION ALL

        SELECT
          'legacy_pos:' || pc.position_change_id,
          pc.session_id,
          pc.driver_id,
          'POSITION_CHANGE',
          pc.lap_number,
          NULL::timestamptz,
          jsonb_build_object(
            'overtaken_driver_id', pc.overtaken_driver_id,
            'position_before', pc.position_before,
            'position_after', pc.position_after
          )
        FROM position_changes pc
        WHERE pc.session_id = ANY($1::varchar[])
          AND pc.submission_id IS NULL

        UNION ALL

        SELECT
          'legacy_penalty:' || p.penalty_id,
          p.session_id,
          p.driver_id,
          'PENALTY_ISSUED',
          p.lap_number,
          NULL::timestamptz,
          jsonb_build_object(
            'penalty_type', p.penalty_type::text,
            'duration_ms', p.duration_ms,
            'reason', COALESCE(p.reason, '')
          )
        FROM penalties p
        WHERE p.session_id = ANY($1::varchar[])
          AND p.submission_id IS NULL

        UNION ALL

        SELECT
          'legacy_retirement:' || r.retirement_id,
          r.session_id,
          r.driver_id,
          'RETIREMENT',
          r.lap_number,
          NULL::timestamptz,
          jsonb_build_object('reason', COALESCE(r.reason, ''))
        FROM retirements r
        WHERE r.session_id = ANY($1::varchar[])
          AND r.submission_id IS NULL
      )
      SELECT
        event_id,
        session_id,
        driver_id,
        type,
        lap_number,
        timestamp,
        payload,
        COUNT(*) OVER()::int AS total_items
      FROM event_log
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY event_id
      ${pagingSql}
    `,
    values
  );

  return {
    rows: result.rows.map(toEvent),
    total_items: result.rows[0]?.total_items ?? 0,
  };
}

/**
 * Every event in a session, unpaginated, for the derivation/statistics layer.
 */
export async function findAllBySession(sessionId: string): Promise<Event[]> {
  return (await querySessionEvents([sessionId])).rows;
}

/**
 * The same event log as findAllBySession, assembled for many sessions in a
 * single query and grouped by session_id.
 *
 * Callers that walk a whole season (controllers/drivers.controller.ts) use
 * this instead of one findAllBySession per session, so query volume stays
 * flat as the calendar grows. It runs the identical UNION above — the point
 * is to widen its predicate, not to reassemble the log in TypeScript, which
 * would risk diverging from the single-session path. Sessions with no events
 * are simply absent from the map; events within each session keep
 * findAllBySession's ordering.
 */
export async function findAllBySessions(
  sessionIds: readonly string[]
): Promise<Map<string, Event[]>> {
  const bySession = new Map<string, Event[]>();

  if (sessionIds.length === 0) return bySession;

  const { rows } = await querySessionEvents(sessionIds);

  for (const event of rows) {
    const existing = bySession.get(event.session_id);

    if (existing === undefined) {
      bySession.set(event.session_id, [event]);
    } else {
      existing.push(event);
    }
  }

  return bySession;
}

/**
 * Returns null only when the race itself does not exist.
 * An existing race/session with no persisted events returns an empty page.
 */
export async function findByRace(
  grandPrixId: string,
  options: FindEventsOptions
): Promise<EventPage | null> {
  if (!(await racesModel.exists(grandPrixId))) return null;

  const session = await sessionsModel.findOneByRaceAndType(
    grandPrixId,
    options.session_type
  );

  if (!session) return { rows: [], total_items: 0 };

  return querySessionEvents(
    [session.session_id],
    options.driver_id,
    options.type,
    { page: options.page, per_page: options.per_page }
  );
}
