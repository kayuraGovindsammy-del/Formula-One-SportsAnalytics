import { describe, expect, it, vi } from "vitest";

vi.mock("../models/laps.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllLapsBySession,
    findByRace: fixtures.findLapsByRace,
  };
});

vi.mock("../models/events.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllEventsBySession,
    findByRace: fixtures.findEventsByRace,
  };
});

import { buildConstructorStatistics } from "./constructorStatistics.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import type { Lap } from "../types/lap.types.js";

const SESSION_ID = "2025_R13_RACE";

function lap(overrides: Partial<Lap>): Lap {
  return {
    session_id: "TEST",
    driver_id: "AAA",
    lap_number: 1,
    lap_time_ms: 100000,
    position: null,
    is_pit_lap: false,
    is_valid: true,
    ...overrides,
  };
}

describe("buildConstructorStatistics — real sample data", () => {
  it("sums McLaren's points from Piastri (P1) and Norris (P2)", async () => {
    // PIA finished P1 (25 points) and NOR finished P2 (18 points) in the
    // sample Belgian GP session -> McLaren's season total is 43.
    const [laps, events] = await Promise.all([
      lapsModel.findAllBySession(SESSION_ID),
      eventsModel.findAllBySession(SESSION_ID),
    ]);

    const stats = buildConstructorStatistics({
      constructor_id: "MCL",
      season: "2025",
      drivers: [
        {
          driver_id: "PIA",
          sessions: [{ session_id: SESSION_ID, laps, events }],
        },
        {
          driver_id: "NOR",
          sessions: [{ session_id: SESSION_ID, laps, events }],
        },
      ],
    });

    expect(stats).toEqual({
      constructor_id: "MCL",
      season: "2025",
      points: 43,
    });
  });
});

describe("buildConstructorStatistics — hand-constructed", () => {
  it("sums both drivers' points for the season", () => {
    // AAA finishes P1 (25), BBB finishes P3 (15) -> constructor total 40.
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      drivers: [
        {
          driver_id: "AAA",
          sessions: [
            {
              session_id: "S1",
              laps: [lap({ driver_id: "AAA", lap_number: 1, position: 1 })],
              events: [],
            },
          ],
        },
        {
          driver_id: "BBB",
          sessions: [
            {
              session_id: "S1",
              laps: [lap({ driver_id: "BBB", lap_number: 1, position: 3 })],
              events: [],
            },
          ],
        },
      ],
    });

    expect(stats).toEqual({
      constructor_id: "TST",
      season: "2025",
      points: 40,
    });
  });

  it("sums points earned across a driver's multiple sessions", () => {
    // AAA: P1 (25) + P2 (18) = 43. BBB: P4 (12). Constructor total 55.
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      drivers: [
        {
          driver_id: "AAA",
          sessions: [
            {
              session_id: "S1",
              laps: [lap({ driver_id: "AAA", lap_number: 1, position: 1 })],
              events: [],
            },
            {
              session_id: "S2",
              laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
              events: [],
            },
          ],
        },
        {
          driver_id: "BBB",
          sessions: [
            {
              session_id: "S1",
              laps: [lap({ driver_id: "BBB", lap_number: 1, position: 4 })],
              events: [],
            },
          ],
        },
      ],
    });

    expect(stats.points).toBe(55);
  });

  it("treats a driver with no derivable position as contributing 0, not null", () => {
    // AAA scores P2 (18). BBB has a lap logged but no recorded position, so
    // his own points come back null - the constructor total still reflects
    // AAA's 18 rather than the whole thing coming back null.
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      drivers: [
        {
          driver_id: "AAA",
          sessions: [
            {
              session_id: "S1",
              laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
              events: [],
            },
          ],
        },
        {
          driver_id: "BBB",
          sessions: [
            {
              session_id: "S1",
              laps: [
                lap({ driver_id: "BBB", lap_number: 1, position: null }),
              ],
              events: [],
            },
          ],
        },
      ],
    });

    expect(stats.points).toBe(18);
  });

  it("returns null when neither driver has a derivable position", () => {
    const stats = buildConstructorStatistics({
      constructor_id: "TST",
      season: "2025",
      drivers: [
        { driver_id: "AAA", sessions: [] },
        { driver_id: "BBB", sessions: [] },
      ],
    });

    expect(stats.points).toBeNull();
  });
});
