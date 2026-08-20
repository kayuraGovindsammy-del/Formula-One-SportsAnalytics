// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — backed by data/sample/events.json via sampleData.ts.
//
// There is no single `events` table in database/schema.sql — the schema stores
// the event log decomposed across `laps`, `pit_stops`, `position_changes`,
// `penalties` and `retirements`. The Postgres replacement for this model
// therefore reassembles the event envelope from those tables (UNION ALL, or a
// view). The exported function signature below is the contract that must
// survive that swap.
//
// Note for the Postgres swap: row order is made explicit (by event_id) rather
// than inherited from file order — keep the equivalent ORDER BY.
// ---------------------------------------------------------------------------

import { rawEvents, type RawEvent } from "./sampleData.js";
import * as racesModel from "./races.model.js";
import * as sessionsModel from "./sessions.model.js";
import { paginate, type PageOptions } from "../utils/pagination.js";
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

function toEvent(raw: RawEvent): Event {
  // Field order follows the example response in docs/api-design.md §4.7.
  // `source` and `note` are sample-data annotations, not part of the contract.
  //
  // `driver_id` and `lap_number` are omitted entirely when absent, per
  // docs/event-schema.md §3 ("Not present on SESSION_START/SESSION_END").
  //
  // `timestamp` is emitted as null when the source event has none. 8 of the 10
  // sample events currently lack it even though event-schema.md marks it
  // required — see the note in the API docs / handover rather than silently
  // inventing a value here.
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

/**
 * Returns `null` when the race itself doesn't exist, so the controller can map
 * that to a 404. A race that exists but has no events for the requested
 * session returns an empty page, not a 404.
 */
export async function findByRace(
  grandPrixId: string,
  options: FindEventsOptions
): Promise<EventPage | null> {
  if (!(await racesModel.exists(grandPrixId))) {
    return null;
  }

  const session = await sessionsModel.findOneByRaceAndType(
    grandPrixId,
    options.session_type
  );

  if (!session) {
    return { rows: [], total_items: 0 };
  }

  const matched = rawEvents
    .filter((raw) => {
      if (raw.session_id !== session.session_id) {
        return false;
      }

      if (options.type !== undefined && raw.type !== options.type) {
        return false;
      }

      if (
        options.driver_id !== undefined &&
        raw.driver_id?.toLowerCase() !== options.driver_id.toLowerCase()
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.event_id.localeCompare(b.event_id));

  return {
    rows: paginate(matched, options).map(toEvent),
    total_items: matched.length,
  };
}
