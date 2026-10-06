// ---------------------------------------------------------------------------
// Ranks drivers by one of their season statistics.
//
// Pure function: no express, no I/O. It ranks the DriverStatistics that
// buildDriverStatistics already derived, so the table can never disagree with
// a driver's own stats.
// ---------------------------------------------------------------------------

import type { DriverStatistics } from "./driverStatistics.js";

export const STANDINGS_SORTS = [
  "points",
  "wins",
  "podiums",
  "fastest_laps",
  "dnfs",
  "average_finish",
] as const;

export type StandingsSort = (typeof STANDINGS_SORTS)[number];

export interface RankedDriver<T extends { statistics: DriverStatistics }> {
  position: number;
  entry: T;
}

/** The value ranked on, or null when the driver has no data for it. */
function sortValue(statistics: DriverStatistics, sortBy: StandingsSort): number | null {
  switch (sortBy) {
    case "points":
      return statistics.points;
    case "wins":
      return statistics.wins;
    case "podiums":
      return statistics.podiums;
    case "fastest_laps":
      return statistics.fastest_laps;
    case "dnfs":
      return statistics.dnf_count;
    case "average_finish":
      return statistics.average_finish_position;
  }
}

/** Lower is better only for average finishing position. */
function ascending(sortBy: StandingsSort): boolean {
  return sortBy === "average_finish";
}

/**
 * Orders entries by `sortBy`, best first, with drivers who have no value for
 * it (null) last. Ties are broken by points, then driver_id, for a stable
 * order, but tied values share a position (standard competition ranking:
 * 1, 2, 2, 4). Returns at most `limit` entries.
 */
export function rankDrivers<T extends { statistics: DriverStatistics }>(
  entries: readonly T[],
  sortBy: StandingsSort,
  limit: number
): RankedDriver<T>[] {
  const direction = ascending(sortBy) ? 1 : -1;

  const sorted = [...entries].sort((a, b) => {
    const left = sortValue(a.statistics, sortBy);
    const right = sortValue(b.statistics, sortBy);

    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      return direction * (left - right);
    }

    const pointsOrder = (b.statistics.points ?? -1) - (a.statistics.points ?? -1);
    if (pointsOrder !== 0) return pointsOrder;

    return a.statistics.driver_id.localeCompare(b.statistics.driver_id);
  });

  const ranked: RankedDriver<T>[] = [];
  for (const [index, entry] of sorted.entries()) {
    const previous = ranked.at(-1);
    const position =
      previous !== undefined &&
      sortValue(previous.entry.statistics, sortBy) === sortValue(entry.statistics, sortBy)
        ? previous.position
        : index + 1;
    ranked.push({ position, entry });
  }

  return ranked.slice(0, limit);
}
