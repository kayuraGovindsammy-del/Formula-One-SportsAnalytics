// ---------------------------------------------------------------------------
// Characterization test for GET /api/v1/drivers/:driver_id/stats.
//
// This pins the *exact* response body the endpoint produces today, for a
// spread of drivers that between them exercise every branch of
// buildDriverStatistics: a winner with a qualifying grid position, a driver
// who lost places, a driver whose grid and finish match, the fastest-lap
// holder with no qualifying data, a driver covered only by a single final lap,
// and a driver who appears nowhere in the logs at all.
//
// Its purpose is not to describe intended behaviour — statistics.routes.test.ts
// already does that, with the reasoning behind each number. This exists so that
// a change to HOW the endpoint loads its data can be shown to change nothing
// about WHAT it returns. Every expectation below was captured from the
// endpoint as it stood before that refactor.
//
// If a deliberate behaviour change ever makes one of these fail, update it in
// the same commit as the change and say so — do not adjust it to make a
// refactor pass.
// ---------------------------------------------------------------------------

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
    findClassificationsBySessions: fixtures.findRaceResultsBySessions,
  };
});

vi.mock("../models/laps.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllLapsBySession,
    findAllBySessions: fixtures.findAllLapsBySessions,
    findByRace: fixtures.findLapsByRace,
  };
});

vi.mock("../models/events.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAllBySession: fixtures.findAllEventsBySession,
    findAllBySessions: fixtures.findAllEventsBySessions,
    findByRace: fixtures.findEventsByRace,
  };
});

import { createApp } from "../app.js";

const app = createApp();

const SEASON = "2025";

/** Response bodies captured from the endpoint, verbatim. */
const CAPTURED_RESPONSES: ReadonlyArray<{
  driver_id: string;
  covers: string;
  body: unknown;
}> = [
  {
    driver_id: "PIA",
    covers: "race winner with a qualifying grid position",
    body: {
      data: {
        driver_id: "PIA",
        season: SEASON,
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
      },
      meta: {},
    },
  },
  {
    driver_id: "NOR",
    covers: "podium finisher who lost a place off the grid",
    body: {
      data: {
        driver_id: "NOR",
        season: SEASON,
        races_entered: 1,
        wins: 0,
        podiums: 1,
        dnf_count: 0,
        dnf_rate: 0,
        fastest_laps: 0,
        average_finish_position: 2,
        average_race_pace_ms: 107260,
        points: 18,
        positions_gained_lost_avg: -1,
      },
      meta: {},
    },
  },
  {
    driver_id: "LEC",
    covers: "podium finisher who held station from the grid",
    body: {
      data: {
        driver_id: "LEC",
        season: SEASON,
        races_entered: 1,
        wins: 0,
        podiums: 1,
        dnf_count: 0,
        dnf_rate: 0,
        fastest_laps: 0,
        average_finish_position: 3,
        average_race_pace_ms: 108030,
        points: 15,
        positions_gained_lost_avg: 0,
      },
      meta: {},
    },
  },
  {
    driver_id: "ANT",
    covers: "fastest-lap holder with no qualifying data",
    body: {
      data: {
        driver_id: "ANT",
        season: SEASON,
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
      },
      meta: {},
    },
  },
  {
    driver_id: "VER",
    covers: "driver covered by a single final-lap record",
    body: {
      data: {
        driver_id: "VER",
        season: SEASON,
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
      },
      meta: {},
    },
  },
  {
    driver_id: "TSU",
    covers: "driver absent from the lap and event logs entirely",
    body: {
      data: {
        driver_id: "TSU",
        season: SEASON,
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
      },
      meta: {},
    },
  },
];

describe("GET /api/v1/drivers/:driver_id/stats — captured responses", () => {
  for (const captured of CAPTURED_RESPONSES) {
    it(`returns the captured body for ${captured.driver_id} (${captured.covers})`, async () => {
      const res = await request(app).get(
        `/api/v1/drivers/${captured.driver_id}/stats?season=${SEASON}`
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(captured.body);
    });
  }

  it("returns the captured body for a season with no sessions", async () => {
    const res = await request(app).get(
      "/api/v1/drivers/PIA/stats?season=1999"
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        driver_id: "PIA",
        season: "1999",
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
      },
      meta: {},
    });
  });

  it("returns the captured NOT_FOUND envelope for an unknown driver", async () => {
    const res = await request(app).get(
      `/api/v1/drivers/ZZZ/stats?season=${SEASON}`
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Driver 'ZZZ' was not found.",
      },
    });
  });
});
