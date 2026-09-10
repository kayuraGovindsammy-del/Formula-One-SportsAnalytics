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
import { pointsForPosition } from "./pointsTable.js";

export interface DriverSessionInput {
  session_id: string;
  /** Every lap in the session, for all drivers (needed to award fastest lap). */
  laps: readonly Lap[];
  /** Every event in the session, for all drivers. */
  events: readonly Event[];
  /**
   * That grand prix's QUALIFYING session events, for all drivers — the source
   * of the starting grid position for positions_gained_lost_avg
   * (docs/f1-statistics.md §2). Omitted when no qualifying data exists for
   * that race, in which case that session simply contributes nothing to the
   * average, same as any other missing data.
   */
  qualifying_events?: readonly Event[];
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
  points: number | null;
  positions_gained_lost_avg: number | null;
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

/**
 * A driver's starting grid position, read directly from a QUALIFYING
 * session's LAP_COMPLETED events — the starting grid IS that session's
 * classification (docs/f1-statistics.md §2). The sample data only carries one
 * qualifying lap per driver (no persisted Lap rows for this session type
 * yet), so this reads the position straight off the events rather than
 * reusing finishingPosition, which takes Lap[]. Mirrors its "last recorded
 * lap wins" rule for consistency, and validates the payload at runtime for
 * the same reason runningOrder.ts does — the event log is fed by user
 * submissions, and a malformed event must be skipped, not trusted.
 */
function qualifyingPosition(
  qualifyingEvents: readonly Event[],
  driverId: string
): number | null {
  let best: { lap_number: number; position: number } | null = null;

  for (const event of qualifyingEvents) {
    if (
      event.type !== "LAP_COMPLETED" ||
      event.driver_id !== driverId ||
      typeof event.lap_number !== "number"
    ) {
      continue;
    }

    const position = (event.payload as { position?: unknown }).position;

    if (
      typeof position === "number" &&
      (best === null || event.lap_number > best.lap_number)
    ) {
      best = { lap_number: event.lap_number, position };
    }
  }

  return best?.position ?? null;
}

export function buildDriverStatistics(
  input: DriverStatisticsInput
): DriverStatistics {
  let racesEntered = 0;
  let wins = 0;
  let podiums = 0;
  let dnfCount = 0;
  let fastestLaps = 0;
  let totalPoints = 0;

  const finishPositions: number[] = [];
  const positionsGainedLost: number[] = [];
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
      totalPoints += pointsForPosition(position);

      if (session.qualifying_events !== undefined) {
        const gridPosition = qualifyingPosition(
          session.qualifying_events,
          input.driver_id
        );

        if (gridPosition !== null) {
          // grid - finish, positive = gained places. See the comment on
          // positions_gained_lost_avg below for why this sign convention was
          // chosen over docs/f1-statistics.md §3's inverted one.
          positionsGainedLost.push(gridPosition - position);
        }
      }

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

    // Sum of pointsForPosition() across every session with a derivable
    // finishing position, per docs/f1-statistics.md §3. Null (not 0) when no
    // position was ever derived, mirroring average_finish_position above —
    // "scored nothing" and "no data" are different answers.
    //
    // KNOWN LIMITATION: only the base race scale applies (see
    // pointsTable.ts) — no fastest-lap bonus point and no sprint scale, since
    // neither is documented anywhere. See docs/f1-statistics.md §3 for the
    // current scope, including which drivers' points can currently be
    // trusted given the sample data's lap coverage.
    points: finishPositions.length > 0 ? totalPoints : null,

    // Average of (grid position - finishing position) across every session
    // where BOTH are derivable — positive means the driver typically gained
    // places, negative means they typically lost them. Null when no session
    // had both, same "no data" convention as the fields above.
    //
    // SIGN CONVENTION: docs/f1-statistics.md §2 defines "positions gained/lost"
    // as grid - finish (positive = gained), but §3's "qualifying-vs-race
    // performance" defines the same underlying comparison as finish - grid
    // (negative = gained) — the exact negation. This field implements §2's
    // convention (matching its own name) and stands in for both catalogue
    // entries rather than duplicating a second, oppositely-signed field for
    // §3. To read this as §3's figure, negate it.
    positions_gained_lost_avg:
      positionsGainedLost.length > 0
        ? roundTo(
            positionsGainedLost.reduce((sum, value) => sum + value, 0) /
              positionsGainedLost.length,
            2
          )
        : null,
  };
}
