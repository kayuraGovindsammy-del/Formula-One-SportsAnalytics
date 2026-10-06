import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { QualifyingData } from "../models/qualifyingResults.model.js";

const mocks = vi.hoisted(() => ({
  findByRace: vi.fn<(grandPrixId: string) => Promise<QualifyingData>>(),
}));

vi.mock("../models/races.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllRaces,
    findById: fixtures.findRaceById,
    exists: fixtures.raceExists,
  };
});

vi.mock("../models/qualifyingResults.model.js", () => ({
  findByRace: mocks.findByRace,
}));

import { createApp } from "../app.js";

const app = createApp();

const classification: QualifyingData["classification"] = [
  {
    position: 1,
    driver_id: "NOR",
    given_name: "Lando",
    family_name: "Norris",
    constructor_id: "MCL",
    constructor_name: "McLaren",
    q1_time_ms: 64962,
    q2_time_ms: 64634,
    q3_time_ms: 63971,
  },
  {
    position: 16,
    driver_id: "STR",
    given_name: "Lance",
    family_name: "Stroll",
    constructor_id: "AMR",
    constructor_name: "Aston Martin",
    q1_time_ms: 65819,
    q2_time_ms: null,
    q3_time_ms: null,
  },
];

describe("GET /api/v1/races/:grand_prix_id/qualifying", () => {
  beforeEach(() => {
    mocks.findByRace.mockReset();
  });

  it("returns the qualifying classification in the success envelope", async () => {
    mocks.findByRace.mockResolvedValue({
      session_id: "2025_R13_QUALIFYING",
      classification,
    });

    const res = await request(app).get("/api/v1/races/2025_R13/qualifying");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        grand_prix_id: "2025_R13",
        session_id: "2025_R13_QUALIFYING",
        classification,
      },
      meta: {},
    });
    expect(mocks.findByRace).toHaveBeenCalledWith("2025_R13");
  });

  it("returns NOT_FOUND for an unknown race without querying qualifying", async () => {
    const res = await request(app).get("/api/v1/races/2025_R99/qualifying");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Race '2025_R99' was not found.",
      },
    });
    expect(mocks.findByRace).not.toHaveBeenCalled();
  });

  it("returns an empty classification when the race has no qualifying session", async () => {
    mocks.findByRace.mockResolvedValue({ session_id: null, classification: [] });

    const res = await request(app).get("/api/v1/races/2025_R13/qualifying");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        grand_prix_id: "2025_R13",
        session_id: null,
        classification: [],
      },
      meta: {},
    });
  });

  it("returns an empty classification for a session with no stored results", async () => {
    mocks.findByRace.mockResolvedValue({
      session_id: "2025_R13_QUALIFYING",
      classification: [],
    });

    const res = await request(app).get("/api/v1/races/2025_R13/qualifying");

    expect(res.status).toBe(200);
    expect(res.body.data.session_id).toBe("2025_R13_QUALIFYING");
    expect(res.body.data.classification).toEqual([]);
  });

  it("is public: no Authorization header is required", async () => {
    mocks.findByRace.mockResolvedValue({ session_id: null, classification: [] });

    const res = await request(app).get("/api/v1/races/2025_R13/qualifying");

    expect(res.status).toBe(200);
  });
});
