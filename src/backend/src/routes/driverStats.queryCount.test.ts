// ---------------------------------------------------------------------------
// Query-volume guard for GET /api/v1/drivers/:driver_id/stats.
//
// The endpoint used to issue one batch of queries per race in the season, so a
// single request cost 2 + 5n queries — 122 across a 24-race calendar, and more
// as the calendar grows. It now loads the whole season up front, so the count
// is fixed no matter how many races there are.
//
// This mocks the *pool* rather than the model layer, so the real SQL in
// src/models/ runs and every getPool().query() is counted. A regression back
// to per-race loading fails here rather than quietly costing a request 100+
// round trips in production.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../config/database.js", async () => {
  const fixtures = await import("../test/countingPool.js");
  const pool = fixtures.createCountingPool();

  return { getPool: () => pool };
});

import {
  fixtureRaceCount,
  fixtureSeason,
  queryCalls,
  resetQueryCalls,
} from "../test/countingPool.js";
import { createApp } from "../app.js";

const app = createApp();

/**
 * One for the driver, one for the season's sessions, then one each for laps,
 * the event log and race_results — every one of the latter three batched over
 * the whole season with `session_id = ANY($1)`.
 */
const MAX_QUERIES = 5;

describe("GET /api/v1/drivers/:driver_id/stats — query volume", () => {
  it("stays within the query budget for a full season", async () => {
    resetQueryCalls();

    const res = await request(app).get(
      `/api/v1/drivers/PIA/stats?season=${fixtureSeason}`
    );

    expect(res.status).toBe(200);
    // Guard against the fixture quietly serving an empty season, which would
    // make the count trivially low.
    expect(res.body.data.races_entered).toBe(fixtureRaceCount);
    expect(fixtureRaceCount).toBeGreaterThan(1);

    expect(queryCalls.length).toBeLessThanOrEqual(MAX_QUERIES);
  });

  it("issues the same number of queries for one race as for a full season", async () => {
    resetQueryCalls();
    await request(app).get(`/api/v1/drivers/PIA/stats?season=${fixtureSeason}`);
    const fullSeason = queryCalls.length;

    resetQueryCalls();
    await request(app).get(`/api/v1/drivers/ANT/stats?season=${fixtureSeason}`);
    const secondDriver = queryCalls.length;

    expect(secondDriver).toBe(fullSeason);
    expect(fullSeason).toBeLessThanOrEqual(MAX_QUERIES);
  });

  it("passes session ids as an array rather than one query per session", async () => {
    resetQueryCalls();
    await request(app).get(`/api/v1/drivers/PIA/stats?season=${fixtureSeason}`);

    const batched = queryCalls.filter((call) =>
      call.sql.includes("ANY($1::varchar[])")
    );

    // laps, the event log and race_results.
    expect(batched).toHaveLength(3);

    for (const call of batched) {
      const sessionIds = call.values[0];

      expect(Array.isArray(sessionIds)).toBe(true);
      expect((sessionIds as readonly unknown[]).length).toBeGreaterThan(1);
    }
  });

  it("issues no event-table queries at all for a season with no sessions", async () => {
    resetQueryCalls();

    const res = await request(app).get("/api/v1/drivers/PIA/stats?season=1999");

    expect(res.status).toBe(200);
    expect(res.body.data.races_entered).toBe(0);
    // Only the driver lookup and the (empty) season sessions query.
    expect(queryCalls.length).toBeLessThanOrEqual(MAX_QUERIES);
  });
});
