// ---------------------------------------------------------------------------
// Route-level proof that GET /api/v1/drivers/:driver_id/stats falls back to
// the ingested race_results position / grid / fastest-lap rank when a driver
// has no lap data - the shape of every Jolpica-ingested race.
//
// The fixtures already give every classified driver laps, so this wraps the
// batched race_results fixture with extra rows for drivers who appear in NO
// lap or event log (ALO, SAI, TSU). Everything else - controller, model
// contract, service, JSON envelope - is the real thing.
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

  const ingestedOnly = (
    driver_id: string,
    overrides: {
      classified_position: number | null;
      grid_position: number | null;
      fastest_lap_rank: number | null;
      points: number;
      status: "FINISHED" | "DNF";
    }
  ) => ({
    // `position` mimics the model's ordinal fallback for a NULL column.
    position: overrides.classified_position ?? 99,
    driver_id,
    constructor_id: "WIL",
    laps: 44,
    pit_stops: 1,
    gap_to_winner_ms: null,
    ...overrides,
  });

  const extraRows = [
    // Won the race, started P4, holds the published fastest lap.
    ingestedOnly("TSU", {
      classified_position: 1,
      grid_position: 4,
      fastest_lap_rank: 1,
      points: 25,
      status: "FINISHED",
    }),
    // Third, from a pit-lane start (grid 0).
    ingestedOnly("SAI", {
      classified_position: 3,
      grid_position: 0,
      fastest_lap_rank: null,
      points: 15,
      status: "FINISHED",
    }),
    // Retired: unclassified, so a NULL position and no finish.
    ingestedOnly("ALO", {
      classified_position: null,
      grid_position: 8,
      fastest_lap_rank: null,
      points: 0,
      status: "DNF",
    }),
  ];

  return {
    findByRace: fixtures.findRaceResults,
    findClassificationsBySessions: async (sessionIds: readonly string[]) => {
      const bySession = await fixtures.findRaceResultsBySessions(sessionIds);

      for (const [sessionId, rows] of bySession) {
        bySession.set(sessionId, [...rows, ...extraRows]);
      }

      return bySession;
    },
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

describe("GET /api/v1/drivers/:driver_id/stats - ingested race_results fallback", () => {
  it("shows non-zero wins and podiums for a driver with no laps but a stored position", async () => {
    const res = await request(app).get("/api/v1/drivers/TSU/stats?season=2025");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      driver_id: "TSU",
      races_entered: 1,
      wins: 1,
      podiums: 1,
      average_finish_position: 1,
      points: 25,
      // Grid 4 (stored) - finish 1 = +3, with no qualifying event for TSU.
      positions_gained_lost_avg: 3,
      // Other drivers' laps exist in this session, so the derived answer
      // stands and TSU's stored rank-1 flag is not trusted over it.
      fastest_laps: 0,
    });
    // Pace genuinely needs laps.
    expect(res.body.data.average_race_pace_ms).toBeNull();
  });

  it("counts a stored P3 as a podium but skips a pit-lane start (grid 0)", async () => {
    const res = await request(app).get("/api/v1/drivers/SAI/stats?season=2025");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      races_entered: 1,
      wins: 0,
      podiums: 1,
      average_finish_position: 3,
      points: 15,
      positions_gained_lost_avg: null,
    });
  });

  it("does not turn a retirement's NULL position into a finish", async () => {
    const res = await request(app).get("/api/v1/drivers/ALO/stats?season=2025");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      races_entered: 1,
      wins: 0,
      podiums: 0,
      average_finish_position: null,
      positions_gained_lost_avg: null,
    });
  });

  it("keeps lap-derived results for drivers who do have laps (laps always win)", async () => {
    const res = await request(app).get("/api/v1/drivers/PIA/stats?season=2025");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      wins: 1,
      podiums: 1,
      average_finish_position: 1,
      positions_gained_lost_avg: 1,
    });
  });
});
