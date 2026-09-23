import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../models/constructors.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findById: fixtures.findConstructorById,
    findDriverIdsBySeason: fixtures.findDriverIdsBySeason,
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

vi.mock("../models/raceResults.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findByRace: fixtures.findRaceResults,
  };
});

import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/constructors/:constructor_id/stats", () => {
  it("sums McLaren's points from Piastri (P1) and Norris (P2)", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/MCL/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(res.body.data).toEqual({
      constructor_id: "MCL",
      season: "2025",
      points: 43,
    });
  });

  it("sums Ferrari's points from Leclerc (P3) and Hamilton (P7)", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/FER/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(21);
  });

  it("counts a teammate with no derivable points as 0, not null", async () => {
    // Red Bull: VER has a real P4 finish (12 pts); TSU appears nowhere in the
    // sample lap/event data, so his own points come back null. The team
    // total should still reflect VER's 12, not the whole thing going null.
    const res = await request(app).get(
      "/api/v1/constructors/RBR/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(12);
  });

  it("resolves a lowercase constructor id to its canonical form", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/mcl/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.constructor_id).toBe("MCL");
  });

  it("requires the season query param", async () => {
    const res = await request(app).get("/api/v1/constructors/MCL/stats");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns NOT_FOUND for an unknown constructor", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/ZZZ/stats?season=2025"
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("ZZZ");
  });

  it("returns null points for a season with no sessions", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/MCL/stats?season=1999"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.season).toBe("1999");
    expect(res.body.data.points).toBeNull();
  });
});
