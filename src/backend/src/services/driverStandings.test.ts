import { describe, expect, it } from "vitest";

import type { DriverStatistics } from "./driverStatistics.js";
import { rankDrivers } from "./driverStandings.js";

function driver(
  driver_id: string,
  overrides: Partial<DriverStatistics> = {}
): { statistics: DriverStatistics } {
  return {
    statistics: {
      driver_id,
      season: "2025",
      races_entered: 24,
      wins: 0,
      podiums: 0,
      dnf_count: 0,
      dnf_rate: 0,
      fastest_laps: 0,
      average_finish_position: null,
      average_race_pace_ms: null,
      points: 0,
      positions_gained_lost_avg: null,
      ...overrides,
    },
  };
}

const grid = [
  driver("VER", { points: 421, wins: 8, podiums: 15, dnf_count: 1, average_finish_position: 3.1 }),
  driver("NOR", { points: 423, wins: 7, podiums: 18, dnf_count: 2, average_finish_position: 2.9 }),
  driver("PIA", { points: 410, wins: 7, podiums: 16, dnf_count: 1, average_finish_position: 3.4 }),
  driver("STR", { points: null, wins: 0, podiums: 0, dnf_count: 4 }),
];

const order = (ranked: ReturnType<typeof rankDrivers>) =>
  ranked.map(({ position, entry }) => `${position}:${entry.statistics.driver_id}`);

describe("rankDrivers", () => {
  it("ranks by points, highest first, with no data last", () => {
    expect(order(rankDrivers(grid, "points", 10))).toEqual(["1:NOR", "2:VER", "3:PIA", "4:STR"]);
  });

  it("gives tied values the same position, ordering them by points", () => {
    // NOR and PIA both have 7 wins; NOR has more points.
    expect(order(rankDrivers(grid, "wins", 10))).toEqual(["1:VER", "2:NOR", "2:PIA", "4:STR"]);
  });

  it("ranks podiums, fastest laps and DNFs highest first", () => {
    expect(order(rankDrivers(grid, "podiums", 10))[0]).toBe("1:NOR");
    expect(order(rankDrivers(grid, "dnfs", 10))[0]).toBe("1:STR");
    expect(order(rankDrivers(grid, "fastest_laps", 10))).toEqual([
      "1:NOR",
      "1:VER",
      "1:PIA",
      "1:STR",
    ]);
  });

  it("ranks average finish lowest first, with no average last", () => {
    expect(order(rankDrivers(grid, "average_finish", 10))).toEqual([
      "1:NOR",
      "2:VER",
      "3:PIA",
      "4:STR",
    ]);
  });

  it("returns at most `limit` drivers", () => {
    expect(rankDrivers(grid, "points", 2)).toHaveLength(2);
  });

  it("does not modify the input", () => {
    const copy = [...grid];
    rankDrivers(grid, "wins", 10);
    expect(grid).toEqual(copy);
  });
});
