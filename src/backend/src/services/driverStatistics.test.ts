import { describe, expect, it } from "vitest";
import { buildDriverStatistics } from "./driverStatistics.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import type { Event } from "../types/event.types.js";
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

async function realSeasonStatsFor(driverId: string) {
  const [laps, events] = await Promise.all([
    lapsModel.findAllBySession(SESSION_ID),
    eventsModel.findAllBySession(SESSION_ID),
  ]);

  return buildDriverStatistics({
    driver_id: driverId,
    season: "2025",
    sessions: [{ session_id: SESSION_ID, laps, events }],
  });
}

describe("buildDriverStatistics — real sample data", () => {
  it("derives Piastri's season figures from the one recorded session", async () => {
    // PIA finished P1 on his last recorded lap (44), so 1 win and 1 podium.
    // Race pace excludes his lap-18 pit lap:
    //   (108250 + 107100 + 106900) / 3 = 322250 / 3 = 107416.67 -> 107417
    // The session's fastest lap belongs to ANT, so PIA's count is 0.
    const stats = await realSeasonStatsFor("PIA");

    expect(stats).toEqual({
      driver_id: "PIA",
      season: "2025",
      races_entered: 1,
      wins: 1,
      podiums: 1,
      dnf_count: 0,
      dnf_rate: 0,
      fastest_laps: 0,
      average_finish_position: 1,
      average_race_pace_ms: 107417,
      points: null,
      positions_gained_lost_avg: null,
    });
  });

  it("credits Antonelli with the session's fastest lap", async () => {
    // ANT's only recorded lap is 32 (104861ms) where he ran P8, so his pace is
    // that single lap and his average finishing position is 8.
    const stats = await realSeasonStatsFor("ANT");

    expect(stats).toEqual({
      driver_id: "ANT",
      season: "2025",
      races_entered: 1,
      wins: 0,
      podiums: 0,
      dnf_count: 0,
      dnf_rate: 0,
      fastest_laps: 1,
      average_finish_position: 8,
      average_race_pace_ms: 104861,
      points: null,
      positions_gained_lost_avg: null,
    });
  });

  it("derives Norris's second place and pace", async () => {
    // (107980 + 107300 + 106500) / 3 = 321780 / 3 = 107260 exactly
    const stats = await realSeasonStatsFor("NOR");

    expect(stats.wins).toBe(0);
    expect(stats.podiums).toBe(1);
    expect(stats.average_finish_position).toBe(2);
    expect(stats.average_race_pace_ms).toBe(107260);
  });

  it("returns zeroes and nulls for a driver with no logged laps", async () => {
    // VER appears nowhere in the sample lap or event data.
    const stats = await realSeasonStatsFor("VER");

    expect(stats).toEqual({
      driver_id: "VER",
      season: "2025",
      races_entered: 0,
      wins: 0,
      podiums: 0,
      dnf_count: 0,
      dnf_rate: null,
      fastest_laps: 0,
      average_finish_position: null,
      average_race_pace_ms: null,
      points: null,
      positions_gained_lost_avg: null,
    });
  });
});

describe("buildDriverStatistics — hand-constructed", () => {
  it("counts a retirement as a DNF", () => {
    const retirement: Event = {
      event_id: "e1",
      session_id: "TEST",
      driver_id: "AAA",
      type: "RETIREMENT",
      lap_number: 12,
      timestamp: null,
      payload: { reason: "Engine failure" },
    };

    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "TEST",
          laps: [
            lap({ driver_id: "AAA", lap_number: 12, lap_time_ms: 100000, position: 14 }),
          ],
          events: [retirement],
        },
      ],
    });

    expect(stats.races_entered).toBe(1);
    expect(stats.dnf_count).toBe(1);
    expect(stats.dnf_rate).toBe(1);
    expect(stats.wins).toBe(0);
  });

  it("averages finishing position and pools pace across two sessions", () => {
    // Finishes: P1 then P3  ->  average = (1 + 3) / 2 = 2
    // Pooled racing laps: 100000, 102000, 104000, 106000
    //   -> (100000 + 102000 + 104000 + 106000) / 4 = 412000 / 4 = 103000
    // Wins 1 (the P1), podiums 2 (P1 and P3).
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [
            lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000, position: 2 }),
            lap({ driver_id: "AAA", lap_number: 2, lap_time_ms: 102000, position: 1 }),
          ],
          events: [],
        },
        {
          session_id: "S2",
          laps: [
            lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 104000, position: 4 }),
            lap({ driver_id: "AAA", lap_number: 2, lap_time_ms: 106000, position: 3 }),
          ],
          events: [],
        },
      ],
    });

    expect(stats.races_entered).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.podiums).toBe(2);
    expect(stats.average_finish_position).toBe(2);
    expect(stats.average_race_pace_ms).toBe(103000);
  });

  it("computes a fractional DNF rate across three sessions", () => {
    // Retired in 1 of 3 sessions -> 1 / 3 = 0.3333 (rounded to 4dp)
    const retirement: Event = {
      event_id: "e1",
      session_id: "S2",
      driver_id: "AAA",
      type: "RETIREMENT",
      lap_number: 5,
      timestamp: null,
      payload: { reason: "Collision" },
    };

    const session = (id: string, events: Event[]) => ({
      session_id: id,
      laps: [
        lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000, position: 5 }),
      ],
      events,
    });

    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        session("S1", []),
        session("S2", [retirement]),
        session("S3", []),
      ],
    });

    expect(stats.races_entered).toBe(3);
    expect(stats.dnf_count).toBe(1);
    expect(stats.dnf_rate).toBe(0.3333);
  });

  it("ignores laps belonging to other drivers", () => {
    // Only AAA's 100000ms lap should count, not BBB's 90000ms one.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [
            lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000, position: 2 }),
            lap({ driver_id: "BBB", lap_number: 1, lap_time_ms: 90000, position: 1 }),
          ],
          events: [],
        },
      ],
    });

    expect(stats.average_race_pace_ms).toBe(100000);
    expect(stats.average_finish_position).toBe(2);
    // The session's fastest lap is BBB's, so AAA is credited with none.
    expect(stats.fastest_laps).toBe(0);
  });

  it("returns nulls for a season with no sessions at all", () => {
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "1999",
      sessions: [],
    });

    expect(stats.races_entered).toBe(0);
    expect(stats.dnf_rate).toBeNull();
    expect(stats.average_finish_position).toBeNull();
    expect(stats.average_race_pace_ms).toBeNull();
  });
});
