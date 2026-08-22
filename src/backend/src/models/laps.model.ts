// ---------------------------------------------------------------------------
// SPRINT 1 PLACEHOLDER — backed by data/sample/laps.json via sampleData.ts.
//
// This is replaced by Postgres queries against the `laps` table in
// database/schema.sql. The exported function signature below is the contract
// that must survive that swap.
//
// Note for the Postgres swap: row order here is made explicit rather than
// inherited from file order, because SQL guarantees no ordering without an
// ORDER BY. Keep the equivalent ORDER BY (driver_id, lap_number).
// ---------------------------------------------------------------------------

import { lapsSessionId, rawLaps, type RawLap } from "./sampleData.js";
import * as racesModel from "./races.model.js";
import * as sessionsModel from "./sessions.model.js";
import { paginate, type PageOptions } from "../utils/pagination.js";
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

function toLap(raw: RawLap, sessionId: string): Lap {
  // Field order follows the example response in docs/api-design.md §4.6.
  // `source` and `note` are sample-data annotations and are not part of the
  // API contract, so they are dropped here.
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

/**
 * Every lap in a session, unpaginated — the derivation engine needs the whole
 * set, not a page of it. Ordered the same way as findByRace.
 */
export async function findAllBySession(sessionId: string): Promise<Lap[]> {
  if (sessionId !== lapsSessionId) {
    return [];
  }

  return [...rawLaps]
    .sort(
      (a, b) =>
        a.driver_id.localeCompare(b.driver_id) || a.lap_number - b.lap_number
    )
    .map((raw) => toLap(raw, lapsSessionId));
}

/**
 * Returns `null` when the race itself doesn't exist, so the controller can map
 * that to a 404. A race that exists but has no laps for the requested session
 * returns an empty page, not a 404.
 */
export async function findByRace(
  grandPrixId: string,
  options: FindLapsOptions
): Promise<LapPage | null> {
  if (!(await racesModel.exists(grandPrixId))) {
    return null;
  }

  const session = await sessionsModel.findOneByRaceAndType(
    grandPrixId,
    options.session_type
  );

  // No such session in this race weekend (or no event data for it at all).
  if (!session || session.session_id !== lapsSessionId) {
    return { rows: [], total_items: 0 };
  }

  const matched = rawLaps
    .filter((raw) => {
      if (
        options.driver_id !== undefined &&
        raw.driver_id.toLowerCase() !== options.driver_id.toLowerCase()
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        a.driver_id.localeCompare(b.driver_id) || a.lap_number - b.lap_number
    );

  return {
    rows: paginate(matched, options).map((raw) => toLap(raw, session.session_id)),
    total_items: matched.length,
  };
}
