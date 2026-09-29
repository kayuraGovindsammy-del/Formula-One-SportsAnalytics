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
 *
 * STATUS: implemented and unit-tested (pitStatistics.test.ts), but not wired
 * to any route or response field — no caller exists outside its own test
 * file (docs/f1-statistics.md's implementation-status table and
 * docs/repo-overview.md call this out explicitly). This is intentional, not
 * forgotten: the natural home is a per-driver `total_pit_time_ms` on
 * `ClassificationRow` (raceStatistics.ts), the same way `consistency_ms` was
 * added there, but that touches a documented and tested response schema in
 * several places at once (openapi.yaml, docs/api-design.md,
 * statistics.routes.test.ts's exact-shape assertions on `classification`) —
 * real design/test surface, not a one-line addition, so it was left for a
 * dedicated pass rather than rushed in under time pressure.
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
