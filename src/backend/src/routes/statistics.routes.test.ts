import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../models/drivers.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllDrivers,
    findById: fixtures.findDriverById,
    getConstructorIdByDriver: fixtures.getConstructorIdByDriver,
  };
});

vi.mock("../models/races.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllRaces,
    findById: fixtures.findRaceById,
    exists: fixtures.raceExists,
  };
});

vi.mock("../models/sessions.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findByRace: fixtures.findSessionsByRace,
    findBySeason: fixtures.findSessionsBySeason,
    findOneByRaceAndType: fixtures.findOneSessionByRaceAndType,
  };
});

vi.mock("../models/raceResults.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findByRace: fixtures.findRaceResults,
  };
});


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

import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/drivers/:driver_id/stats", () => {
  it("returns Piastri's derived season statistics", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/PIA/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data).toEqual({
      driver_id: "PIA",
      season: "2025",
      races_entered: 1,
      wins: 1,
      podiums: 1,
      dnf_count: 0,
      dnf_rate: 0,
      fastest_laps: 0,
      average_finish_position: 1,
      // (108250 + 107100 + 106900) / 3 = 107416.67 -> 107417
      average_race_pace_ms: 107417,
      // P1 -> pointsForPosition(1) = 25
      points: 25,
      // Grid P2 from the matching QUALIFYING session, finish P1 -> +1.
      positions_gained_lost_avg: 1,
    });
  });

  it("keeps positions_gained_lost_avg null when qualifying data is missing", async () => {
    // ANT's only derivable position is P8 (from lap 32, not his true finish -
    // see docs/f1-statistics.md's note on sample-data coverage), so points
    // comes back as pointsForPosition(8) = 4 rather than null.
    // ANT has no qualifying event in the fixture, so there is no grid
    // position to compare with the derived race position.
    const res = await request(app).get(
      "/api/v1/drivers/ANT/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(4);
    expect(res.body.data.positions_gained_lost_avg).toBeNull();
    expect(res.body.data.fastest_laps).toBe(1);
  });

  it("derives a real finishing position and points for a newly-covered driver (issue #55)", async () => {
    // VER now has one recorded lap (44, his real classification finish),
    // added to expand the sample-data trust boundary beyond PIA/NOR/LEC.
    const res = await request(app).get(
      "/api/v1/drivers/VER/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.races_entered).toBe(1);
    expect(res.body.data.average_finish_position).toBe(4);
    // P4 -> pointsForPosition(4) = 12
    expect(res.body.data.points).toBe(12);
    // No QUALIFYING event exists for VER, so this stays null.
    expect(res.body.data.positions_gained_lost_avg).toBeNull();
  });

  it("returns an empty season for a driver with no logged laps", async () => {
    // TSU appears nowhere in the sample lap or event data.
    const res = await request(app).get(
      "/api/v1/drivers/TSU/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.races_entered).toBe(0);
    expect(res.body.data.average_race_pace_ms).toBeNull();
    expect(res.body.data.dnf_rate).toBeNull();
  });

  it("returns an empty season for a year with no sessions", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/PIA/stats?season=1999"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.season).toBe("1999");
    expect(res.body.data.races_entered).toBe(0);
  });

  it("resolves a lowercase driver id to its canonical form", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/pia/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.driver_id).toBe("PIA");
  });

  it("requires the season query param", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/PIA/stats"
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns NOT_FOUND for an unknown driver", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/ZZZ/stats?season=2025"
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("ZZZ");
  });
});

describe("GET /api/v1/races/:grand_prix_id/statistics", () => {
  it("returns the derived Belgian GP classification without overwriting it from race_results", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R13/statistics"
    );

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data.fastest_lap).toEqual({
      driver_id: "ANT",
      lap_number: 32,
      lap_time_ms: 104861,
    });

    // The lap/event derivation now has eleven supported drivers (issue #55
    // added VER/RUS/ALB/HAM/LAW/BOR/GAS's real final-lap position alongside
    // PIA/NOR/LEC/ANT) and includes consistency_ms. Before #60 the controller
    // replaced these rows with the stored 10-driver reference classification,
    // losing this field.
    expect(res.body.data.classification).toEqual([
      {
        position: 1,
        driver_id: "PIA",
        constructor_id: "MCL",
        laps: 44,
        pit_stops: 1,
        consistency_ms: 595,
        gap_to_winner_ms: null,
      },
      {
        position: 2,
        driver_id: "NOR",
        constructor_id: "MCL",
        laps: 44,
        pit_stops: 1,
        consistency_ms: 605,
        gap_to_winner_ms: null,
      },
      {
        position: 3,
        driver_id: "LEC",
        constructor_id: "FER",
        laps: 44,
        pit_stops: 1,
        consistency_ms: 651,
        gap_to_winner_ms: null,
      },
      {
        position: 4,
        driver_id: "VER",
        constructor_id: "RBR",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 5,
        driver_id: "RUS",
        constructor_id: "MER",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 6,
        driver_id: "ALB",
        constructor_id: "WIL",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 7,
        driver_id: "HAM",
        constructor_id: "FER",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 8,
        driver_id: "ANT",
        constructor_id: "MER",
        laps: 32,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 8,
        driver_id: "LAW",
        constructor_id: "RB",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 9,
        driver_id: "BOR",
        constructor_id: "SAU",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
      {
        position: 10,
        driver_id: "GAS",
        constructor_id: "ALP",
        laps: 44,
        pit_stops: 0,
        consistency_ms: 0,
        gap_to_winner_ms: null,
      },
    ]);
  });

  it("derives a top three matching the known race result", async () => {
    // Reference (ESPN / RaceFans, 2025 Belgian GP): 1 Piastri, 2 Norris,
    // 3 Leclerc.
    const res = await request(app).get(
      "/api/v1/races/2025_R13/statistics"
    );

    expect(
      res.body.data.classification
        .slice(0, 3)
        .map((row: { driver_id: string }) => row.driver_id)
    ).toEqual(["PIA", "NOR", "LEC"]);
  });

  it("returns NOT_FOUND for a race with no event log", async () => {
    // §4.8 — a race whose has_results is false 404s rather than returning an
    // empty body. 2025_R01 (Australian GP) has no session data.
    const res = await request(app).get(
      "/api/v1/races/2025_R01/statistics"
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for an unknown race", async () => {
    const res = await request(app).get(
      "/api/v1/races/2025_R99/statistics"
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("2025_R99");
  });
});