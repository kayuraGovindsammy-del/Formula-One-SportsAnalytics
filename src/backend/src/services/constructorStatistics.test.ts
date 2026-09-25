import { describe, expect, it } from "vitest";

import {
  buildConstructorStatistics,
  type ConstructorPointRow,
} from "./constructorStatistics.js";

function row(
  constructorId: string,
  driverId: string,
  points: number
): ConstructorPointRow {
  return {
    constructor_id: constructorId,
    driver_id: driverId,
    points,
  };
}

describe("buildConstructorStatistics", () => {
  it("sums McLaren's points from Piastri (P1) and Norris (P2)", () => {
    const stats = buildConstructorStatistics({
      constructor_id: "MCL",
      season: "2025",
      results: [
        row("MCL", "PIA", 25),
        row("MCL", "NOR", 18),
        row("FER", "LEC", 15),
      ],
    });

    expect(stats).toEqual({
      constructor_id: "MCL",
      season: "2025",
      points: 43,
    });
  });

  it("sums a constructor's points across several races", () => {
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      results: [
        row("TST", "AAA", 25),
        row("TST", "BBB", 12),
        row("TST", "AAA", 18),
        row("TST", "BBB", 0),
      ],
    });

    expect(stats.points).toBe(55);
  });

  it("ignores rows belonging to other constructors", () => {
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      results: [
        row("TST", "AAA", 10),
        row("OTH", "BBB", 25),
        row("OTH", "CCC", 18),
      ],
    });

    expect(stats.points).toBe(10);
  });

  describe("mid-season team changes", () => {
    // The bug this replaced: team membership came from
    // driver_constructor_links, which is season-level with no date range, so
    // a driver who switched teams had their WHOLE season credited to one
    // team. Each result row records the constructor for THAT race, so the
    // points split at the race the driver actually moved.
    const season: ConstructorPointRow[] = [
      // SWI drives for OLD in the first two races, then moves to NEW.
      row("OLD", "SWI", 25),
      row("OLD", "SWI", 10),
      row("NEW", "SWI", 18),
      row("NEW", "SWI", 6),
      // A team-mate who stayed put at each team all season.
      row("OLD", "STAY", 4),
      row("NEW", "STAY", 2),
    ];

    it("credits the old team only the races driven for it", () => {
      const stats = buildConstructorStatistics({
        constructor_id: "OLD",
        season: "2025",
        results: season,
      });

      // 25 + 10 from SWI before the move, + 4 from STAY. NOT SWI's 59.
      expect(stats.points).toBe(39);
    });

    it("credits the new team only the races driven for it", () => {
      const stats = buildConstructorStatistics({
        constructor_id: "NEW",
        season: "2025",
        results: season,
      });

      // 18 + 6 from SWI after the move, + 2 from STAY.
      expect(stats.points).toBe(26);
    });

    it("splits the switcher's points across both teams without double-counting", () => {
      const old = buildConstructorStatistics({
        constructor_id: "OLD",
        season: "2025",
        results: season,
      }).points;

      const next = buildConstructorStatistics({
        constructor_id: "NEW",
        season: "2025",
        results: season,
      }).points;

      const total = season.reduce((sum, r) => sum + r.points, 0);

      expect((old ?? 0) + (next ?? 0)).toBe(total);
    });
  });

  describe("null versus zero", () => {
    it("returns null when the constructor has no rows that season", () => {
      const stats = buildConstructorStatistics({
        constructor_id: "AMR",
        season: "2025",
        results: [row("MCL", "PIA", 25)],
      });

      expect(stats.points).toBeNull();
    });

    it("returns null when the season has no rows at all", () => {
      const stats = buildConstructorStatistics({
        constructor_id: "MCL",
        season: "1999",
        results: [],
      });

      expect(stats.points).toBeNull();
    });

    it("returns 0, not null, when rows exist but score nothing", () => {
      // The case that made teams read "No points data yet" when they had
      // simply finished out of the points: rows exist, so this is a real
      // scoreless season, not missing data.
      const stats = buildConstructorStatistics({
        constructor_id: "HAA",
        season: "2025",
        results: [row("HAA", "BEA", 0), row("HAA", "OCO", 0)],
      });

      expect(stats.points).toBe(0);
    });

    it("returns 0 when a team has no link row but does have results", () => {
      // Nothing consults driver_constructor_links, so a constructor missing
      // from it still reports whatever its result rows total.
      const stats = buildConstructorStatistics({
        constructor_id: "UNL",
        season: "2025",
        results: [row("UNL", "AAA", 0), row("UNL", "BBB", 8)],
      });

      expect(stats.points).toBe(8);
    });
  });

  it("matches the constructor id case-insensitively", () => {
    const stats = buildConstructorStatistics({
      constructor_id: "mcl",
      season: "2025",
      results: [row("MCL", "PIA", 25)],
    });

    expect(stats.points).toBe(25);
    // The id is echoed back exactly as supplied; the controller passes the
    // canonical form it resolved from constructors.model.ts findById.
    expect(stats.constructor_id).toBe("mcl");
  });

  it("sums fractional points without losing precision to the half-point rule", () => {
    // race_results.points is NUMERIC(6,2); a half-points race is exactly the
    // kind of value the derived P1-P10 scale cannot produce.
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      results: [row("TST", "AAA", 12.5), row("TST", "BBB", 4.5)],
    });

    expect(stats.points).toBe(17);
  });
});
