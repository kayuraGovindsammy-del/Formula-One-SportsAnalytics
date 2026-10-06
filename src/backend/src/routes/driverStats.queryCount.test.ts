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
import {
  loadDriverStandings,
  loadDriverStatistics,
} from "../controllers/drivers.controller.js";

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

describe("loadDriverStandings (chat get_driver_standings) — query volume and agreement", () => {
  it("ranks the whole grid in a fixed number of queries, with no query per driver", async () => {
    resetQueryCalls();

    const result = await loadDriverStandings(fixtureSeason, "points", 25);

    // The season sessions, laps, event log and race_results (batched over
    // the whole season, as for one driver), plus one names query.
    expect(queryCalls.length).toBeLessThanOrEqual(5);
    expect(result.total_drivers).toBeGreaterThan(5);
    expect(result.standings.length).toBe(result.total_drivers);
  });

  it("reports exactly what loadDriverStatistics reports, for every driver", async () => {
    const { standings } = await loadDriverStandings(fixtureSeason, "points", 25);
    expect(standings.some((row) => row.podiums > 1)).toBe(true);

    for (const row of standings) {
      const own = await loadDriverStatistics(row.driver_id, fixtureSeason);
      expect(own).not.toBeNull();
      expect({
        points: row.points,
        wins: row.wins,
        podiums: row.podiums,
        fastest_laps: row.fastest_laps,
        dnfs: row.dnfs,
        average_finish_position: row.average_finish_position,
        races_entered: row.races_entered,
      }).toEqual({
        points: own?.points,
        wins: own?.wins,
        podiums: own?.podiums,
        fastest_laps: own?.fastest_laps,
        dnfs: own?.dnf_count,
        average_finish_position: own?.average_finish_position,
        races_entered: own?.races_entered,
      });
    }
  });
});
