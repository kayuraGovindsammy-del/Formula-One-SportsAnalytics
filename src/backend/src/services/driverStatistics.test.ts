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
import { buildDriverStatistics } from "./driverStatistics.js";
import * as eventsModel from "../models/events.model.js";
import * as lapsModel from "../models/laps.model.js";
import type { Event } from "../types/event.types.js";
import type { Lap } from "../types/lap.types.js";

const SESSION_ID = "2025_R13_RACE";
const QUALIFYING_SESSION_ID = "2025_R13_QUALIFYING";

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

/** A minimal QUALIFYING-session LAP_COMPLETED event, position-only. */
function qualifyingEvent(driverId: string, position: number): Event {
  return {
    event_id: `q-${driverId}`,
    session_id: "TEST_QUALIFYING",
    driver_id: driverId,
    type: "LAP_COMPLETED",
    lap_number: 1,
    timestamp: null,
    payload: { lap_time_ms: 90000, position, is_pit_lap: false, is_valid: true },
  };
}

async function realSeasonStatsFor(driverId: string) {
  const [laps, events, qualifyingEvents] = await Promise.all([
    lapsModel.findAllBySession(SESSION_ID),
    eventsModel.findAllBySession(SESSION_ID),
    eventsModel.findAllBySession(QUALIFYING_SESSION_ID),
  ]);

  return buildDriverStatistics({
    driver_id: driverId,
    season: "2025",
    sessions: [
      {
        session_id: SESSION_ID,
        laps,
        events,
        qualifying_events: qualifyingEvents,
      },
    ],
  });
}

describe("buildDriverStatistics — real sample data", () => {
  it("derives Piastri's season figures from the one recorded session", async () => {
    // PIA finished P1 on his last recorded lap (44), so 1 win and 1 podium,
    // and 25 points on the standard race scale (pointsForPosition(1)).
    // Race pace excludes his lap-18 pit lap:
    //   (108250 + 107100 + 106900) / 3 = 322250 / 3 = 107416.67 -> 107417
    // The session's fastest lap belongs to ANT, so PIA's count is 0.
    // Grid P2 (evt_012) minus finish P1 -> gained 1 place.
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
      points: 25,
      positions_gained_lost_avg: 1,
    });
  });

  it("credits Antonelli with the session's fastest lap", async () => {
    // ANT's only recorded lap is 32 (104861ms) where he ran P8, so his pace is
    // that single lap and his average finishing position is 8 ->
    // pointsForPosition(8) = 4. (P8 here is a mid-race snapshot, not ANT's
    // true finish - see docs/f1-statistics.md's note on sample-data coverage.)
    // ANT has no QUALIFYING event in the sample data, so
    // positions_gained_lost_avg stays null - not because he lacks a race
    // finish, but because there's no grid position to compare it against.
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
      points: 4,
      positions_gained_lost_avg: null,
    });
  });

  it("derives Norris's second place and pace", async () => {
    // (107980 + 107300 + 106500) / 3 = 321780 / 3 = 107260 exactly
    // P2 -> pointsForPosition(2) = 18
    // Grid P1 (pole, evt_011) minus finish P2 -> lost 1 place.
    const stats = await realSeasonStatsFor("NOR");

    expect(stats.wins).toBe(0);
    expect(stats.podiums).toBe(1);
    expect(stats.average_finish_position).toBe(2);
    expect(stats.average_race_pace_ms).toBe(107260);
    expect(stats.points).toBe(18);
    expect(stats.positions_gained_lost_avg).toBe(-1);
  });

  it("derives Leclerc's unchanged grid slot", async () => {
    // Grid P3 (evt_013, illustrative placeholder) minus finish P3 -> 0, no
    // places gained or lost.
    const stats = await realSeasonStatsFor("LEC");

    expect(stats.average_finish_position).toBe(3);
    expect(stats.positions_gained_lost_avg).toBe(0);
  });

  it("derives Verstappen's real finishing position and points (issue #55)", async () => {
    // VER's only recorded lap is 44 (his real classification finish, sourced
    // from session_result.classification P4) - unlike ANT's lap 32, this IS
    // his finish, so his position/points are trustworthy. His pace/
    // consistency are not: the lap time itself is an illustrative
    // placeholder, and he has no QUALIFYING event, so
    // positions_gained_lost_avg stays null.
    const stats = await realSeasonStatsFor("VER");

    expect(stats).toEqual({
      driver_id: "VER",
      season: "2025",
      races_entered: 1,
      wins: 0,
      podiums: 0,
      dnf_count: 0,
      dnf_rate: 0,
      fastest_laps: 0,
      average_finish_position: 4,
      average_race_pace_ms: 108500,
      points: 12,
      positions_gained_lost_avg: null,
    });
  });

  it("returns zeroes and nulls for a driver with no logged laps", async () => {
    // TSU appears nowhere in the sample lap or event data.
    const stats = await realSeasonStatsFor("TSU");

    expect(stats).toEqual({
      driver_id: "TSU",
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
    // Retired running P14 -> pointsForPosition(14) = 0 (not null - a
    // position was derivable, it just scores nothing).
    expect(stats.points).toBe(0);
  });

  it("averages finishing position and pools pace across two sessions", () => {
    // Finishes: P1 then P3  ->  average = (1 + 3) / 2 = 2
    // Pooled racing laps: 100000, 102000, 104000, 106000
    //   -> (100000 + 102000 + 104000 + 106000) / 4 = 412000 / 4 = 103000
    // Wins 1 (the P1), podiums 2 (P1 and P3).
    // Points: pointsForPosition(1) + pointsForPosition(3) = 25 + 15 = 40
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
    expect(stats.points).toBe(40);
  });

  it("computes a fractional DNF rate across three sessions", () => {
    // Retired in 1 of 3 sessions -> 1 / 3 = 0.3333 (rounded to 4dp)
    // Ran P5 in all three -> pointsForPosition(5) * 3 = 10 * 3 = 30
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
    expect(stats.points).toBe(30);
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
    // AAA's own P2 -> pointsForPosition(2) = 18, unaffected by BBB's laps.
    expect(stats.points).toBe(18);
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
    expect(stats.points).toBeNull();
  });
});

describe("buildDriverStatistics — ingested race_results.points (stored_points)", () => {
  it("prefers stored_points over the derived scale when they disagree", () => {
    // Finished P1 (derived scale would give 25), but a sprint/half-points
    // scenario means the ingested value is 13 instead — proves the override
    // actually takes effect rather than coincidentally matching.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 1 })],
          events: [],
          stored_points: 13,
        },
      ],
    });

    expect(stats.points).toBe(13);
  });

  it("counts a stored-points-only session as entered, with no lap or event log at all", () => {
    // The common shape for a Jolpica-ingested race: race_results exists, but
    // no lap-by-lap telemetry was ever ingested. Before this, such a session
    // was skipped entirely and contributed nothing.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [],
          events: [],
          stored_points: 18,
        },
      ],
    });

    expect(stats.races_entered).toBe(1);
    expect(stats.points).toBe(18);
    // No lap data means no derivable finish, win, podium, or pace for this
    // session — stored_points fills in points only, not the rest.
    expect(stats.wins).toBe(0);
    expect(stats.podiums).toBe(0);
    expect(stats.average_finish_position).toBeNull();
    expect(stats.average_race_pace_ms).toBeNull();
  });

  it("treats a stored 0 as an authoritative result, not a missing one", () => {
    // Finished P11 or lower (scores 0 on the real scale too), NOT the same as
    // "no ingested row" — the derived fallback must not kick in here.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 11 })],
          events: [],
          stored_points: 0,
        },
      ],
    });

    expect(stats.points).toBe(0);
  });

  it("sums a stored-points session and a derived-fallback session together", () => {
    // S1 has an ingested result (13 pts); S2 has no race_results row, so it
    // falls back to pointsForPosition(3) = 15. Total: 28.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 1 })],
          events: [],
          stored_points: 13,
        },
        {
          session_id: "S2",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 3 })],
          events: [],
        },
      ],
    });

    expect(stats.points).toBe(28);
  });
});

describe("buildDriverStatistics — positions_gained_lost_avg, hand-constructed", () => {
  it("computes grid minus finish for a single session (gained places)", () => {
    // Started P5, finished P2 -> gained 3 places.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
          events: [],
          qualifying_events: [qualifyingEvent("AAA", 5)],
        },
      ],
    });

    expect(stats.positions_gained_lost_avg).toBe(3);
  });

  it("returns a negative value when the driver lost places", () => {
    // Started P1, finished P4 -> lost 3 places.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 4 })],
          events: [],
          qualifying_events: [qualifyingEvent("AAA", 1)],
        },
      ],
    });

    expect(stats.positions_gained_lost_avg).toBe(-3);
  });

  it("averages across sessions, counting only those with a derivable grid position", () => {
    // S1: grid 5 -> finish 2, gained 3. S2: no qualifying data, contributes
    // nothing. S3: grid 3 -> finish 3, gained 0.
    // Average over the 2 sessions with data: (3 + 0) / 2 = 1.5
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
          events: [],
          qualifying_events: [qualifyingEvent("AAA", 5)],
        },
        {
          session_id: "S2",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 6 })],
          events: [],
        },
        {
          session_id: "S3",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 3 })],
          events: [],
          qualifying_events: [qualifyingEvent("AAA", 3)],
        },
      ],
    });

    expect(stats.races_entered).toBe(3);
    expect(stats.positions_gained_lost_avg).toBe(1.5);
  });

  it("returns null when no session has a derivable grid position", () => {
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
          events: [],
        },
      ],
    });

    expect(stats.positions_gained_lost_avg).toBeNull();
  });

  it("ignores another driver's qualifying event", () => {
    // The qualifying event belongs to BBB, not AAA - AAA has no grid position
    // of his own, so his positions_gained_lost_avg stays null.
    const stats = buildDriverStatistics({
      driver_id: "AAA",
      season: "2025",
      sessions: [
        {
          session_id: "S1",
          laps: [lap({ driver_id: "AAA", lap_number: 1, position: 2 })],
          events: [],
          qualifying_events: [qualifyingEvent("BBB", 1)],
        },
      ],
    });

    expect(stats.positions_gained_lost_avg).toBeNull();
  });
});
