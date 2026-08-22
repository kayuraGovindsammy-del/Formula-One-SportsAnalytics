import { describe, expect, it } from "vitest";
import { buildRaceStatistics } from "./raceStatistics.js";
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

async function realBelgianGpStatistics() {
  const [laps, events] = await Promise.all([
    lapsModel.findAllBySession(SESSION_ID),
    eventsModel.findAllBySession(SESSION_ID),
  ]);

  return buildRaceStatistics({
    grand_prix_id: "2025_R13",
    session_id: SESSION_ID,
    total_laps: 44,
    laps,
    events,
    constructor_id_by_driver: {
      PIA: "MCL",
      NOR: "MCL",
      LEC: "FER",
      ANT: "MER",
    },
  });
}

describe("buildRaceStatistics — real sample data", () => {
  it("derives the fastest lap rather than reading session_result", async () => {
    // Reference: ANT, lap 32, 1:44.861 = 104861ms — the official fastest lap
    // of the 2025 Belgian GP. The identical figure sits in the
    // `session_result` block of events.json, which this code never reads.
    const stats = await realBelgianGpStatistics();

    expect(stats.fastest_lap).toEqual({
      driver_id: "ANT",
      lap_number: 32,
      lap_time_ms: 104861,
    });
  });

  it("counts pit stops, overtakes and retirements from the log", async () => {
    const stats = await realBelgianGpStatistics();

    // 3 PIT_STOP events (evt_005/006/007), 1 POSITION_CHANGE (evt_004),
    // and no RETIREMENT events at all.
    expect(stats.pit_stop_count).toBe(3);
    expect(stats.overtake_count).toBe(1);
    expect(stats.retirement_count).toBe(0);
    expect(stats.dnf_count).toBe(0);
  });

  it("derives the classification from each driver's last recorded lap", async () => {
    // Reference: the real top three were PIA, NOR, LEC in that order, which
    // is what the lap log reproduces.
    //
    // ANT appears at position 8 because his last RECORDED lap is 32, where he
    // was running 8th — the sample data has no later lap for him, so this is a
    // mid-race position, not a finishing one. Positions are reported exactly
    // as derived and deliberately not renumbered to 1,2,3,4.
    const stats = await realBelgianGpStatistics();

    expect(stats.classification).toEqual([
      {
        position: 1,
        driver_id: "PIA",
        constructor_id: "MCL",
        laps: 44,
        pit_stops: 1,
        gap_to_winner_ms: null,
      },
      {
        position: 2,
        driver_id: "NOR",
        constructor_id: "MCL",
        laps: 44,
        pit_stops: 1,
        gap_to_winner_ms: null,
      },
      {
        position: 3,
        driver_id: "LEC",
        constructor_id: "FER",
        laps: 44,
        pit_stops: 1,
        gap_to_winner_ms: null,
      },
      {
        position: 8,
        driver_id: "ANT",
        constructor_id: "MER",
        laps: 32,
        pit_stops: 0,
        gap_to_winner_ms: null,
      },
    ]);
  });

  it("reports null gaps because the sample lap log is incomplete", async () => {
    // The sample holds 4 of 44 laps per driver, so a cumulative race time
    // cannot be derived. Null is returned rather than a plausible-looking gap
    // computed from partial data.
    const stats = await realBelgianGpStatistics();

    for (const row of stats.classification) {
      expect(row.gap_to_winner_ms).toBeNull();
    }
  });

  it("carries the session identifiers through unchanged", async () => {
    const stats = await realBelgianGpStatistics();

    expect(stats.grand_prix_id).toBe("2025_R13");
    expect(stats.session_id).toBe(SESSION_ID);
    expect(stats.total_laps).toBe(44);
  });
});

describe("buildRaceStatistics — hand-constructed", () => {
  it("derives real gaps when every lap of the session is present", () => {
    // A complete 2-lap session:
    //   AAA: 50000 + 50000 = 100000  (finishes P1)
    //   BBB: 51000 + 51000 = 102000  (finishes P2)
    // gap for BBB = 102000 - 100000 = 2000
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 50000, position: 1 }),
      lap({ driver_id: "AAA", lap_number: 2, lap_time_ms: 50000, position: 1 }),
      lap({ driver_id: "BBB", lap_number: 1, lap_time_ms: 51000, position: 2 }),
      lap({ driver_id: "BBB", lap_number: 2, lap_time_ms: 51000, position: 2 }),
    ];

    const stats = buildRaceStatistics({
      grand_prix_id: "TEST_R1",
      session_id: "TEST",
      total_laps: 2,
      laps,
      events: [],
      constructor_id_by_driver: { AAA: "AAA_TEAM", BBB: "BBB_TEAM" },
    });

    expect(stats.classification).toEqual([
      {
        position: 1,
        driver_id: "AAA",
        constructor_id: "AAA_TEAM",
        laps: 2,
        pit_stops: 0,
        gap_to_winner_ms: 0,
      },
      {
        position: 2,
        driver_id: "BBB",
        constructor_id: "BBB_TEAM",
        laps: 2,
        pit_stops: 0,
        gap_to_winner_ms: 2000,
      },
    ]);
  });

  it("falls back to null gaps as soon as one driver's log has a hole", () => {
    // BBB is missing lap 2, so no cumulative comparison is possible.
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 50000, position: 1 }),
      lap({ driver_id: "AAA", lap_number: 2, lap_time_ms: 50000, position: 1 }),
      lap({ driver_id: "BBB", lap_number: 1, lap_time_ms: 51000, position: 2 }),
    ];

    const stats = buildRaceStatistics({
      grand_prix_id: "TEST_R1",
      session_id: "TEST",
      total_laps: 2,
      laps,
      events: [],
      constructor_id_by_driver: {},
    });

    expect(stats.classification.map((row) => row.gap_to_winner_ms)).toEqual([
      null,
      null,
    ]);
  });

  it("returns an empty classification for a session with no laps", () => {
    const stats = buildRaceStatistics({
      grand_prix_id: "TEST_R1",
      session_id: "TEST",
      total_laps: 44,
      laps: [],
      events: [],
      constructor_id_by_driver: {},
    });

    expect(stats.classification).toEqual([]);
    expect(stats.fastest_lap).toBeNull();
    expect(stats.pit_stop_count).toBe(0);
  });

  it("omits a driver whose last lap has no recorded position", () => {
    // A position cannot be derived for BBB, so rather than inventing one the
    // driver is left out of the classification entirely.
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 50000, position: 1 }),
      lap({ driver_id: "BBB", lap_number: 1, lap_time_ms: 51000, position: null }),
    ];

    const stats = buildRaceStatistics({
      grand_prix_id: "TEST_R1",
      session_id: "TEST",
      total_laps: 1,
      laps,
      events: [],
      constructor_id_by_driver: {},
    });

    expect(stats.classification).toHaveLength(1);
    expect(stats.classification[0]?.driver_id).toBe("AAA");
  });

  it("reports a null constructor_id for a driver missing from the lookup", () => {
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 50000, position: 1 }),
    ];

    const stats = buildRaceStatistics({
      grand_prix_id: "TEST_R1",
      session_id: "TEST",
      total_laps: 1,
      laps,
      events: [],
      constructor_id_by_driver: {},
    });

    expect(stats.classification[0]?.constructor_id).toBeNull();
  });
});
