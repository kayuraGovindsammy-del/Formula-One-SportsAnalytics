// ---------------------------------------------------------------------------
// Race statistics — docs/api-design.md §4.8.
//
// Pure function: no express, no req/res, no file or database access. Everything
// it returns is computed from the laps and events handed in.
//
// IMPORTANT: data/sample/events.json contains a `session_result` block with the
// finishing order and fastest lap already filled in. That block is a REFERENCE
// for checking these derivations against — it is never read here, and the model
// layer never serves it. Every figure below is recomputed from the log.
// ---------------------------------------------------------------------------

import type { Event } from "../types/event.types.js";
import type { Lap } from "../types/lap.types.js";
import { fastestLap, lapConsistency, type FastestLap } from "./lapStatistics.js";
import { pitStopCount } from "./pitStatistics.js";

export interface RaceStatisticsInput {
  grand_prix_id: string;
  session_id: string;
  total_laps: number | null;
  /**
   * Every lap in the session, for all drivers. Laps are the persisted form of
   * LAP_COMPLETED events (docs/data-model.md), so they are the lap-level source
   * of truth here.
   */
  laps: readonly Lap[];
  /** Every event in the session, for all drivers. */
  events: readonly Event[];
  /** driver_id -> constructor_id. Passed in so this stays free of data access. */
  constructor_id_by_driver: Readonly<Record<string, string>>;
}

export interface ClassificationRow {
  position: number;
  driver_id: string;
  constructor_id: string | null;
  laps: number;
  pit_stops: number;
  consistency_ms: number | null;
  gap_to_winner_ms: number | null;
}

export interface RaceStatistics {
  grand_prix_id: string;
  session_id: string;
  total_laps: number | null;
  fastest_lap: FastestLap | null;
  pit_stop_count: number;
  overtake_count: number;
  retirement_count: number;
  dnf_count: number;
  classification: ClassificationRow[];
}

function countEventsOfType(events: readonly Event[], type: string): number {
  return events.filter((event) => event.type === type).length;
}

function lastRecordedLap(laps: readonly Lap[]): Lap | null {
  let latest: Lap | null = null;

  for (const lap of laps) {
    if (latest === null || lap.lap_number > latest.lap_number) {
      latest = lap;
    }
  }

  return latest;
}

/**
 * True when a driver has a lap recorded for every lap of the session, which is
 * what deriving a cumulative race time requires.
 */
function hasCompleteLapLog(
  laps: readonly Lap[],
  totalLaps: number | null
): boolean {
  if (totalLaps === null || totalLaps <= 0) {
    return false;
  }

  const lapNumbers = new Set(laps.map((lap) => lap.lap_number));

  for (let lap = 1; lap <= totalLaps; lap += 1) {
    if (!lapNumbers.has(lap)) {
      return false;
    }
  }

  return true;
}

function cumulativeTimeMs(laps: readonly Lap[]): number | null {
  let total = 0;

  for (const lap of laps) {
    if (lap.lap_time_ms === null) {
      return null;
    }

    total += lap.lap_time_ms;
  }

  return total;
}

export function buildRaceStatistics(
  input: RaceStatisticsInput
): RaceStatistics {
  const lapsByDriver = new Map<string, Lap[]>();

  for (const lap of input.laps) {
    const existing = lapsByDriver.get(lap.driver_id);

    if (existing) {
      existing.push(lap);
    } else {
      lapsByDriver.set(lap.driver_id, [lap]);
    }
  }

  // --- Classification -----------------------------------------------------
  // Finishing position is the position on each driver's last recorded lap,
  // per docs/f1-statistics.md §2.
  //
  // KNOWN LIMITATION: with a complete log the last recorded lap IS the final
  // lap. With the sample subset it is merely the last lap that happens to be in
  // the file — e.g. ANT's last recorded lap is 32, so his "position" is his
  // lap-32 position, not where he finished. Positions are reported exactly as
  // derived and are deliberately NOT renumbered into a contiguous 1..N, which
  // would invent a classification the log doesn't support.
  const rows: Omit<ClassificationRow, "gap_to_winner_ms">[] = [];

  for (const [driverId, driverLaps] of lapsByDriver) {
    const finalLap = lastRecordedLap(driverLaps);

    if (finalLap === null || finalLap.position === null) {
      // No derivable position — omitted rather than assigned a made-up one.
      continue;
    }

    rows.push({
      position: finalLap.position,
      driver_id: driverId,
      constructor_id: input.constructor_id_by_driver[driverId] ?? null,
      laps: finalLap.lap_number,
      pit_stops: input.events.filter(
        (event) => event.type === "PIT_STOP" && event.driver_id === driverId
      ).length,
      // Per driver, per docs/f1-statistics.md §2 — pooling across drivers
      // would mix each car's own lap-time spread with the gap between
      // drivers' pace levels, which isn't what "consistency" means here.
      consistency_ms: lapConsistency(driverLaps),
    });
  }

  rows.sort(
    (a, b) => a.position - b.position || a.driver_id.localeCompare(b.driver_id)
  );

  // --- Gap to winner ------------------------------------------------------
  // Requires a cumulative race time, which requires every lap of every
  // classified driver. The sample data holds 4 laps of 44, so gaps come back
  // null rather than as a plausible-looking figure derived from partial data.
  const everyoneComplete =
    rows.length > 0 &&
    rows.every((row) =>
      hasCompleteLapLog(lapsByDriver.get(row.driver_id) ?? [], input.total_laps)
    );

  const winnerTotalMs = everyoneComplete
    ? cumulativeTimeMs(lapsByDriver.get(rows[0]!.driver_id) ?? [])
    : null;

  const classification: ClassificationRow[] = rows.map((row) => {
    let gap: number | null = null;

    if (winnerTotalMs !== null) {
      const driverTotal = cumulativeTimeMs(lapsByDriver.get(row.driver_id) ?? []);
      gap = driverTotal === null ? null : driverTotal - winnerTotalMs;
    }

    return { ...row, gap_to_winner_ms: gap };
  });

  // A RETIREMENT event is exactly what marks a DNF (docs/f1-statistics.md §2),
  // so these two counts are currently the same derivation. They are reported
  // separately because a disqualification (a PENALTY_ISSUED of type
  // DISQUALIFICATION) would raise dnf_count without being a retirement.
  const retirementCount = countEventsOfType(input.events, "RETIREMENT");

  return {
    grand_prix_id: input.grand_prix_id,
    session_id: input.session_id,
    total_laps: input.total_laps,
    fastest_lap: fastestLap(input.laps),
    pit_stop_count: pitStopCount(input.events),
    overtake_count: countEventsOfType(input.events, "POSITION_CHANGE"),
    retirement_count: retirementCount,
    dnf_count: retirementCount,
    classification,
  };
}
