// ---------------------------------------------------------------------------
// Pit-stop statistics derived from the PIT_STOP event stream.
//
// Pure functions: no express, no req/res, no file or database access.
// ---------------------------------------------------------------------------

import type { Event, PitStopPayload } from "../types/event.types.js";

/**
 * Reads `duration_ms` off a PIT_STOP event.
 *
 * The payload is checked at runtime rather than trusted, because the event log
 * is populated from user submissions — a PIT_STOP missing its duration must not
 * silently contribute NaN to a total.
 */
function pitStopDurationMs(event: Event): number | null {
  if (event.type !== "PIT_STOP") {
    return null;
  }

  const payload = event.payload as PitStopPayload;

  return typeof payload.duration_ms === "number" ? payload.duration_ms : null;
}

/** Number of PIT_STOP events in the given stream. */
export function pitStopCount(events: readonly Event[]): number {
  return events.filter((event) => event.type === "PIT_STOP").length;
}

/**
 * Total time spent stationary, in milliseconds, across all PIT_STOP events.
 *
 * Returns null when there are no pit stops at all — distinguishing "never
 * pitted" from "pitted for zero time". Stops whose payload carries no
 * duration are skipped, so a partially-recorded log still totals what it can.
 */
export function totalPitTime(events: readonly Event[]): number | null {
  const durations = events
    .map(pitStopDurationMs)
    .filter((duration): duration is number => duration !== null);

  if (durations.length === 0) {
    return null;
  }

  return durations.reduce((sum, duration) => sum + duration, 0);
}
