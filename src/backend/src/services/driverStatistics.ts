// ---------------------------------------------------------------------------
// Per-driver season statistics — docs/api-design.md §4.3.
//
// Pure function: no express, no req/res, no file or database access.
//
// As with raceStatistics, the `session_result` block in the sample data is a
// reference to check against, never a source. Everything here is recomputed
// from that season's laps and events.
// ---------------------------------------------------------------------------

import type { Event } from "../types/event.types.js";
import type { Lap } from "../types/lap.types.js";
import { averageLapTime, fastestLap, isRacingLap } from "./lapStatistics.js";

export interface DriverSessionInput {
  session_id: string;
  /** Every lap in the session, for all drivers (needed to award fastest lap). */
  laps: readonly Lap[];
  /** Every event in the session, for all drivers. */
  events: readonly Event[];
}

export interface DriverStatisticsInput {
  driver_id: string;
  season: string;
  sessions: readonly DriverSessionInput[];
}

export interface DriverStatistics {
  driver_id: string;
  season: string;
  races_entered: number;
  wins: number;
  podiums: number;
  dnf_count: number;
  dnf_rate: number | null;
  fastest_laps: number;
  average_finish_position: number | null;
  average_race_pace_ms: number | null;
  points: null;
  positions_gained_lost_avg: null;
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;

  return Math.round(value * factor) / factor;
}

/** Position on the driver's last recorded lap, per docs/f1-statistics.md §2. */
function finishingPosition(driverLaps: readonly Lap[]): number | null {
  let latest: Lap | null = null;

  for (const lap of driverLaps) {
    if (latest === null || lap.lap_number > latest.lap_number) {
      latest = lap;
    }
  }

  return latest?.position ?? null;
}

export function buildDriverStatistics(
  input: DriverStatisticsInput
): DriverStatistics {
  let racesEntered = 0;
  let wins = 0;
  let podiums = 0;
  let dnfCount = 0;
  let fastestLaps = 0;

  const finishPositions: number[] = [];
  const racingLapsAcrossSeason: Lap[] = [];

  for (const session of input.sessions) {
    const driverLaps = session.laps.filter(
      (lap) => lap.driver_id === input.driver_id
    );

    const driverEvents = session.events.filter(
      (event) => event.driver_id === input.driver_id
    );

    // A driver counts as having entered if the log shows them at all.
    if (driverLaps.length === 0 && driverEvents.length === 0) {
      continue;
    }

    racesEntered += 1;

    const position = finishingPosition(driverLaps);

    if (position !== null) {
      finishPositions.push(position);

      if (position === 1) {
        wins += 1;
      }

      if (position <= 3) {
        podiums += 1;
      }
    }

    if (driverEvents.some((event) => event.type === "RETIREMENT")) {
      dnfCount += 1;
    }

    // Fastest lap of the session is derived across ALL drivers' laps, then
    // checked for ownership — it is not read from any FASTEST_LAP_SET event,
    // which would be trusting a stored total instead of deriving it.
    const sessionFastest = fastestLap(session.laps);

    if (sessionFastest?.driver_id === input.driver_id) {
      fastestLaps += 1;
    }

    racingLapsAcrossSeason.push(...driverLaps.filter(isRacingLap));
  }

  const averageFinishPosition =
    finishPositions.length > 0
      ? roundTo(
          finishPositions.reduce((sum, position) => sum + position, 0) /
            finishPositions.length,
          2
        )
      : null;

  return {
    driver_id: input.driver_id,
    season: input.season,
    races_entered: racesEntered,
    wins,
    podiums,
    dnf_count: dnfCount,
    dnf_rate: racesEntered > 0 ? roundTo(dnfCount / racesEntered, 4) : null,
    fastest_laps: fastestLaps,
    average_finish_position: averageFinishPosition,

    // Race pace pools every racing lap the driver ran across the season, rather
    // than averaging per-session averages, so a session with more laps carries
    // proportionally more weight.
    //
    // KNOWN LIMITATION: with no safety car flag in the event schema, laps run
    // behind the safety car are included and inflate this figure. See
    // docs/derivation.md.
    average_race_pace_ms: averageLapTime(racingLapsAcrossSeason),

    // Not derivable from the current schema — see docs/api-design.md §9.
    // points: no points-scoring rule is defined anywhere in the schema or docs.
    // positions_gained_lost_avg: needs the starting grid from a QUALIFYING
    // session classification, and no qualifying data exists yet.
    points: null,
    positions_gained_lost_avg: null,
  };
}
