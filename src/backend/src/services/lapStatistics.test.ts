import { describe, expect, it, vi } from "vitest";

vi.mock("../models/laps.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllLapsBySession,
    findByRace: fixtures.findLapsByRace,
  };
});
import {
  averageLapTime,
  fastestLap,
  lapConsistency,
} from "./lapStatistics.js";
import * as lapsModel from "../models/laps.model.js";
import type { Lap } from "../types/lap.types.js";

// Every expected value below is a literal worked out by hand (or by separate
// arithmetic) and shown in a comment. None of them is produced by calling the
// function under test — a test that computes its expectation with the same
// logic it is checking proves nothing.

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

/** Real sample laps for one driver, straight from data/sample/laps.json. */
async function sampleLapsFor(driverId: string): Promise<Lap[]> {
  const all = await lapsModel.findAllBySession(SESSION_ID);

  return all.filter((entry) => entry.driver_id === driverId);
}

describe("averageLapTime — hand-constructed", () => {
  it("averages two racing laps", () => {
    // (100000 + 102000) / 2 = 101000
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: 102000 }),
    ];

    expect(averageLapTime(laps)).toBe(101000);
  });

  it("excludes pit laps", () => {
    // Only laps 1 and 3 count: (100000 + 102000) / 2 = 101000
    // The 130000 pit lap would drag the mean to 110666.67 if wrongly included.
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: 130000, is_pit_lap: true }),
      lap({ lap_number: 3, lap_time_ms: 102000 }),
    ];

    expect(averageLapTime(laps)).toBe(101000);
  });

  it("excludes laps deleted by the stewards", () => {
    // Only laps 1 and 3 count: (100000 + 102000) / 2 = 101000
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: 90000, is_valid: false }),
      lap({ lap_number: 3, lap_time_ms: 102000 }),
    ];

    expect(averageLapTime(laps)).toBe(101000);
  });

  it("excludes laps with no recorded time", () => {
    // (100000 + 102000) / 2 = 101000
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: null }),
      lap({ lap_number: 3, lap_time_ms: 102000 }),
    ];

    expect(averageLapTime(laps)).toBe(101000);
  });

  it("rounds the mean half-up to whole milliseconds", () => {
    // (1000 + 1001) / 2 = 1000.5 -> 1001
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 1000 }),
      lap({ lap_number: 2, lap_time_ms: 1001 }),
    ];

    expect(averageLapTime(laps)).toBe(1001);
  });

  it("returns the lap's own time for a single lap", () => {
    expect(averageLapTime([lap({ lap_time_ms: 98765 })])).toBe(98765);
  });

  it("returns null for an empty array", () => {
    expect(averageLapTime([])).toBeNull();
  });

  it("returns null when every lap is a pit lap", () => {
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 130000, is_pit_lap: true }),
      lap({ lap_number: 2, lap_time_ms: 131000, is_pit_lap: true }),
    ];

    expect(averageLapTime(laps)).toBeNull();
  });

  it("returns null when every lap was deleted", () => {
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000, is_valid: false }),
      lap({ lap_number: 2, lap_time_ms: 101000, is_valid: false }),
    ];

    expect(averageLapTime(laps)).toBeNull();
  });
});

describe("averageLapTime — real sample data", () => {
  it("computes PIA's race pace, excluding his lap-18 pit stop", async () => {
    // PIA's laps in data/sample/laps.json: 1 (108250), 5 (107100),
    // 18 (128400, is_pit_lap) and 44 (106900).
    // Excluding the pit lap: (108250 + 107100 + 106900) / 3
    //   = 322250 / 3
    //   = 107416.666...
    //   -> 107417 rounded
    expect(averageLapTime(await sampleLapsFor("PIA"))).toBe(107417);
  });

  it("computes NOR's race pace, excluding his lap-19 pit stop", async () => {
    // (107980 + 107300 + 106500) / 3 = 321780 / 3 = 107260 exactly
    expect(averageLapTime(await sampleLapsFor("NOR"))).toBe(107260);
  });

  it("computes LEC's race pace, excluding his lap-17 pit stop", async () => {
    // (108790 + 108100 + 107200) / 3 = 324090 / 3 = 108030 exactly
    expect(averageLapTime(await sampleLapsFor("LEC"))).toBe(108030);
  });

  it("returns ANT's single recorded lap as his pace", async () => {
    // ANT has exactly one lap in the sample: lap 32, 104861ms.
    expect(averageLapTime(await sampleLapsFor("ANT"))).toBe(104861);
  });
});

describe("fastestLap — hand-constructed", () => {
  it("ignores a quicker pit lap", () => {
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000 }),
      lap({
        driver_id: "BBB",
        lap_number: 2,
        lap_time_ms: 90000,
        is_pit_lap: true,
      }),
    ];

    expect(fastestLap(laps)).toEqual({
      driver_id: "AAA",
      lap_number: 1,
      lap_time_ms: 100000,
    });
  });

  it("ignores a quicker deleted lap", () => {
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000 }),
      lap({
        driver_id: "BBB",
        lap_number: 2,
        lap_time_ms: 90000,
        is_valid: false,
      }),
    ];

    expect(fastestLap(laps)).toEqual({
      driver_id: "AAA",
      lap_number: 1,
      lap_time_ms: 100000,
    });
  });

  it("picks the genuinely quickest racing lap", () => {
    const laps = [
      lap({ driver_id: "AAA", lap_number: 1, lap_time_ms: 100000 }),
      lap({ driver_id: "BBB", lap_number: 2, lap_time_ms: 99000 }),
      lap({ driver_id: "CCC", lap_number: 3, lap_time_ms: 101000 }),
    ];

    expect(fastestLap(laps)).toEqual({
      driver_id: "BBB",
      lap_number: 2,
      lap_time_ms: 99000,
    });
  });

  it("breaks a tie in favour of the lap set first", () => {
    const laps = [
      lap({ driver_id: "BBB", lap_number: 9, lap_time_ms: 99000 }),
      lap({ driver_id: "AAA", lap_number: 4, lap_time_ms: 99000 }),
    ];

    expect(fastestLap(laps)).toEqual({
      driver_id: "AAA",
      lap_number: 4,
      lap_time_ms: 99000,
    });
  });

  it("returns null for an empty array", () => {
    expect(fastestLap([])).toBeNull();
  });

  it("returns null when every lap is a pit lap", () => {
    expect(
      fastestLap([lap({ lap_time_ms: 130000, is_pit_lap: true })])
    ).toBeNull();
  });
});

describe("fastestLap — real sample data", () => {
  it("derives the session's fastest lap, matching the known race result", async () => {
    // Reference: the official fastest lap of the 2025 Belgian GP was
    // Antonelli, lap 32, 1:44.861 = 104861ms. The same figure appears in the
    // `session_result.fastest_lap` block of data/sample/events.json, which the
    // derivation deliberately does NOT read — this asserts the value is
    // recomputed from the lap log and agrees with the known-correct result.
    const laps = await lapsModel.findAllBySession(SESSION_ID);

    expect(fastestLap(laps)).toEqual({
      driver_id: "ANT",
      lap_number: 32,
      lap_time_ms: 104861,
    });
  });
});

describe("lapConsistency — hand-constructed", () => {
  it("computes the population standard deviation of two laps", () => {
    // mean = (1000 + 3000) / 2 = 2000
    // deviations = -1000, +1000  ->  squares 1000000, 1000000
    // variance = 2000000 / 2 = 1000000  ->  sqrt = 1000
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 1000 }),
      lap({ lap_number: 2, lap_time_ms: 3000 }),
    ];

    expect(lapConsistency(laps)).toBe(1000);
  });

  it("computes the population standard deviation of three laps", () => {
    // mean = (100 + 200 + 300) / 3 = 200
    // deviations = -100, 0, +100  ->  squares 10000, 0, 10000
    // variance = 20000 / 3 = 6666.667  ->  sqrt = 81.6497  ->  82
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100 }),
      lap({ lap_number: 2, lap_time_ms: 200 }),
      lap({ lap_number: 3, lap_time_ms: 300 }),
    ];

    expect(lapConsistency(laps)).toBe(82);
  });

  it("returns 0 for identical lap times", () => {
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: 100000 }),
    ];

    expect(lapConsistency(laps)).toBe(0);
  });

  it("returns 0 for a single lap", () => {
    // Arithmetically correct (no spread from one value), but it says nothing
    // about consistency — documented in docs/derivation.md.
    expect(lapConsistency([lap({ lap_time_ms: 100000 })])).toBe(0);
  });

  it("ignores pit laps when measuring spread", () => {
    // Only the two 100000ms laps count, so the spread is 0. Including the
    // 130000ms pit lap would give a stddev of about 14142.
    const laps = [
      lap({ lap_number: 1, lap_time_ms: 100000 }),
      lap({ lap_number: 2, lap_time_ms: 130000, is_pit_lap: true }),
      lap({ lap_number: 3, lap_time_ms: 100000 }),
    ];

    expect(lapConsistency(laps)).toBe(0);
  });

  it("returns null for an empty array", () => {
    expect(lapConsistency([])).toBeNull();
  });

  it("returns null when every lap is a pit lap", () => {
    expect(
      lapConsistency([lap({ lap_time_ms: 130000, is_pit_lap: true })])
    ).toBeNull();
  });
});

describe("lapConsistency — real sample data", () => {
  it("computes PIA's consistency over his three racing laps", async () => {
    // laps 108250, 107100, 106900; mean = 322250 / 3 = 107416.667
    // deviations   = +833.333, -316.667, -516.667
    // squares      = 694444.4, 100277.8, 266944.4  ->  sum 1061666.7
    // variance     = 1061666.7 / 3 = 353888.9
    // sqrt         = 594.8856  ->  595
    expect(lapConsistency(await sampleLapsFor("PIA"))).toBe(595);
  });

  it("computes NOR's consistency over his three racing laps", async () => {
    // laps 107980, 107300, 106500; mean = 321780 / 3 = 107260
    // deviations = +720, +40, -760  ->  squares 518400, 1600, 577600
    // variance   = 1097600 / 3 = 365866.667  ->  sqrt = 604.8691  ->  605
    expect(lapConsistency(await sampleLapsFor("NOR"))).toBe(605);
  });

  it("computes LEC's consistency over his three racing laps", async () => {
    // laps 108790, 108100, 107200; mean = 324090 / 3 = 108030
    // deviations = +760, +70, -830  ->  squares 577600, 4900, 688900
    // variance   = 1271400 / 3 = 423800  ->  sqrt = 650.9992  ->  651
    expect(lapConsistency(await sampleLapsFor("LEC"))).toBe(651);
  });
});
