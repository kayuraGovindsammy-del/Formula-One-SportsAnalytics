// ---------------------------------------------------------------------------
// Lap-derived statistics.
//
// Pure functions: no express, no req/res, no file or database access. They take
// arrays of laps and return computed values, which is what makes them testable
// in isolation and independent of where the laps came from.
//
// KNOWN LIMITATION — safety car / red flag periods
// -----------------------------------------------
// docs/event-schema.md has no `is_under_safety_car` flag on LAP_COMPLETED, so
// there is no way to tell a genuine slow lap from one run behind the safety
// car. Every function here that averages or spreads lap times therefore
// INCLUDES safety-car-distorted laps, which inflates average pace and
// consistency (a stddev especially). This is flagged in docs/derivation.md
// as a known gap rather than hidden behind a number that looks plausible.
// ---------------------------------------------------------------------------

import type { Lap } from "../types/lap.types.js";

/** A lap with a usable time — the narrowed form the maths below operates on. */
type TimedLap = Lap & { lap_time_ms: number };

/**
 * A "racing lap": one that counts toward pace and fastest-lap figures.
 *
 * Excludes:
 *  - pit laps (`is_pit_lap`) — artificially slow, per docs/f1-statistics.md §2
 *  - deleted laps (`is_valid === false`) — e.g. track limits
 *  - laps with no recorded time — nothing to average
 *
 * Note: data/sample/laps.json currently contains no invalid laps, so the
 * is_valid branch is exercised only by the hand-constructed unit tests.
 */
export function isRacingLap(lap: Lap): lap is TimedLap {
  return lap.is_valid && !lap.is_pit_lap && lap.lap_time_ms !== null;
}

export interface FastestLap {
  driver_id: string;
  lap_number: number;
  lap_time_ms: number;
}

/**
 * Mean lap time in whole milliseconds across valid, non-pit laps.
 *
 * Returns null when no racing laps remain, rather than 0 or NaN — "no data" and
 * "a pace of zero" are different answers and the caller must be able to tell
 * them apart.
 *
 * ROUNDING: the mean is rounded (half up) to an integer. Lap times are recorded
 * in whole milliseconds, so sub-millisecond precision in an average is noise;
 * returning a float would also make expected values in tests fragile. E.g.
 * (108250 + 107100 + 106900) / 3 = 107416.67 -> 107417.
 */
export function averageLapTime(laps: readonly Lap[]): number | null {
  const racingLaps = laps.filter(isRacingLap);

  if (racingLaps.length === 0) {
    return null;
  }

  const total = racingLaps.reduce((sum, lap) => sum + lap.lap_time_ms, 0);

  return Math.round(total / racingLaps.length);
}

/**
 * The quickest valid, non-pit lap. Returns null when there are no racing laps.
 *
 * Ties are broken by the earlier lap_number, so the driver who set the time
 * first holds it — the same convention F1 uses.
 */
export function fastestLap(laps: readonly Lap[]): FastestLap | null {
  const racingLaps = laps.filter(isRacingLap);

  if (racingLaps.length === 0) {
    return null;
  }

  let best = racingLaps[0] as TimedLap;

  for (const lap of racingLaps) {
    if (
      lap.lap_time_ms < best.lap_time_ms ||
      (lap.lap_time_ms === best.lap_time_ms && lap.lap_number < best.lap_number)
    ) {
      best = lap;
    }
  }

  return {
    driver_id: best.driver_id,
    lap_number: best.lap_number,
    lap_time_ms: best.lap_time_ms,
  };
}

/**
 * Spread of valid, non-pit lap times — lower means a more consistent driver.
 *
 * POPULATION standard deviation, not sample: the laps handed in are the entire
 * set of laps run, not a sample drawn from a larger pool, so dividing by n
 * (rather than n - 1) is the correct denominator.
 *
 * ROUNDING: to whole milliseconds, for the same reason as averageLapTime.
 *
 * A single racing lap yields 0 by definition. That is arithmetically correct
 * but says nothing about consistency — see docs/derivation.md.
 */
export function lapConsistency(laps: readonly Lap[]): number | null {
  const racingLaps = laps.filter(isRacingLap);

  if (racingLaps.length === 0) {
    return null;
  }

  const mean =
    racingLaps.reduce((sum, lap) => sum + lap.lap_time_ms, 0) /
    racingLaps.length;

  const variance =
    racingLaps.reduce(
      (sum, lap) => sum + (lap.lap_time_ms - mean) ** 2,
      0
    ) / racingLaps.length;

  return Math.round(Math.sqrt(variance));
}
