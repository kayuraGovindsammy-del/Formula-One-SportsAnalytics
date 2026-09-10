// ---------------------------------------------------------------------------
// Per-constructor season statistics — docs/f1-statistics.md §3.
//
// Pure function: no express, no req/res, no file or database access.
//
// Constructor points are the sum of both registered drivers' season points
// (docs/f1-statistics.md §3), so this composes buildDriverStatistics rather
// than re-deriving finishing positions from the lap/event log a second time —
// each driver's points are already correctly derived there.
// ---------------------------------------------------------------------------

import {
  buildDriverStatistics,
  type DriverStatisticsInput,
} from "./driverStatistics.js";

export interface ConstructorStatisticsInput {
  constructor_id: string;
  season: string;
  /**
   * The two drivers registered to this constructor for the season
   * (docs/f1-statistics.md §3: "both drivers registered to that constructor
   * for the season"). Each carries its own session data, the same shape
   * buildDriverStatistics takes.
   */
  drivers: readonly Pick<DriverStatisticsInput, "driver_id" | "sessions">[];
}

export interface ConstructorStatistics {
  constructor_id: string;
  season: string;
  points: number | null;
}

export function buildConstructorStatistics(
  input: ConstructorStatisticsInput
): ConstructorStatistics {
  const driverPoints = input.drivers.map(
    (driver) =>
      buildDriverStatistics({
        driver_id: driver.driver_id,
        season: input.season,
        sessions: driver.sessions,
      }).points
  );

  // A driver with no derivable points contributes nothing to the total,
  // rather than forcing the whole constructor total to null — the total is
  // only null when NEITHER driver has any points to contribute.
  const knownPoints = driverPoints.filter(
    (points): points is number => points !== null
  );

  return {
    constructor_id: input.constructor_id,
    season: input.season,
    points:
      knownPoints.length > 0
        ? knownPoints.reduce((sum, points) => sum + points, 0)
        : null,
  };
}
