import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../models/constructors.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findById: fixtures.findConstructorById,
    findSeasonPointRows: fixtures.findSeasonPointRows,
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

  it("counts a constructor with a single scoring row", async () => {
    // Red Bull: VER has a P4 row (12 pts) in the sample classification and
    // TSU has none. The total is VER's 12 — a team-mate with no result row
    // contributes nothing rather than forcing the team total to null.
    const res = await request(app).get(
      "/api/v1/constructors/RBR/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(12);
  });

  it("reports points for every constructor in the sample classification", async () => {
    // Guards the undercount this change fixed: nothing is read from
    // driver_constructor_links, so a team's total depends only on whether it
    // has result rows.
    const expected: Record<string, number> = {
      MCL: 43,
      FER: 21,
      RBR: 12,
      MER: 10,
      WIL: 8,
      RB: 4,
      SAU: 2,
      ALP: 1,
    };

    for (const [constructorId, points] of Object.entries(expected)) {
      const res = await request(app).get(
        `/api/v1/constructors/${constructorId}/stats?season=2025`
      );

      expect(res.status).toBe(200);
      expect({ [constructorId]: res.body.data.points }).toEqual({
        [constructorId]: points,
      });
    }
  });

  it("returns null for a constructor with no rows in the season", async () => {
    // AMR is a real constructor but does not appear in the sample
    // classification, so there is genuinely no data — distinct from 0.
    const res = await request(app).get(
      "/api/v1/constructors/AMR/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBeNull();
  });

  it("resolves a lowercase constructor id to its canonical form", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/mcl/stats?season=2025"
    );

    expect(res.status).toBe(200);
    expect(res.body.data.constructor_id).toBe("MCL");
    expect(res.body.data.points).toBe(43);
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

  it("keeps the response shape to exactly the three documented fields", async () => {
    const res = await request(app).get(
      "/api/v1/constructors/MCL/stats?season=2025"
    );

    expect(Object.keys(res.body.data).sort()).toEqual([
      "constructor_id",
      "points",
      "season",
    ]);
  });
});
