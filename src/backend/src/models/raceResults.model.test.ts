import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../config/database.js", () => ({
  getPool: () => ({ query: mocks.query }),
}));

import { findByRace } from "./raceResults.model.js";

function sessionRow(sessionId: string) {
  return { rows: [{ session_id: sessionId }] };
}

function resultsRows(rows: unknown[]) {
  return { rows };
}

describe("raceResultsModel.findByRace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no RACE session exists for the grand prix", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });

    const result = await findByRace("2025_R99");

    expect(result).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("returns null when the session exists but has no race_results rows", async () => {
    mocks.query
      .mockResolvedValueOnce(sessionRow("2025_R13_RACE"))
      .mockResolvedValueOnce(resultsRows([]));

    const result = await findByRace("2025_R13");

    expect(result).toBeNull();
  });

  it("selects status and points (as a number, not the NUMERIC string pg returns) for each classified driver", async () => {
    mocks.query
      .mockResolvedValueOnce(sessionRow("2025_R13_RACE"))
      .mockResolvedValueOnce(
        resultsRows([
          {
            position: 1,
            grid_position: 3,
            driver_id: "PIA",
            constructor_id: "MCL",
            laps_completed: 44,
            pit_stops: 1,
            gap_to_winner_ms: 0,
            fastest_lap_rank: 2,
            fastest_lap_number: null,
            fastest_lap_time_ms: null,
            points: "25.00",
            status: "FINISHED",
          },
          {
            position: null,
            grid_position: 0,
            driver_id: "HAM",
            constructor_id: "FER",
            laps_completed: 20,
            pit_stops: 1,
            gap_to_winner_ms: null,
            fastest_lap_rank: 5,
            fastest_lap_number: null,
            fastest_lap_time_ms: null,
            points: "0.00",
            status: "DNF",
          },
        ])
      )
      .mockResolvedValueOnce({ rows: [] });

    const result = await findByRace("2025_R13");

    expect(result?.classification).toEqual([
      {
        position: 1,
        classified_position: 1,
        grid_position: 3,
        fastest_lap_rank: 2,
        driver_id: "PIA",
        constructor_id: "MCL",
        laps: 44,
        pit_stops: 1,
        gap_to_winner_ms: 0,
        points: 25,
        status: "FINISHED",
      },
      {
        // Unclassified in race_results: `position` falls back to the ordinal
        // so the classification still renders, but classified_position stays
        // null so driverStatistics never counts it as a finish.
        position: 2,
        classified_position: null,
        grid_position: 0,
        fastest_lap_rank: 5,
        driver_id: "HAM",
        constructor_id: "FER",
        laps: 20,
        pit_stops: 1,
        gap_to_winner_ms: null,
        points: 0,
        status: "DNF",
      },
    ]);

    // Confirms the SELECT actually asks for the status column, not just that
    // the mocked row happens to echo one back.
    const resultsQuerySql = mocks.query.mock.calls[1]?.[0] as string;
    expect(resultsQuerySql).toContain("status");
    expect(resultsQuerySql).toContain("points");
  });

  it("falls back to row order for an unclassified position", async () => {
    mocks.query
      .mockResolvedValueOnce(sessionRow("2025_R13_RACE"))
      .mockResolvedValueOnce(
        resultsRows([
          {
            position: null,
            driver_id: "BOR",
            constructor_id: "SAU",
            laps_completed: 0,
            pit_stops: 0,
            gap_to_winner_ms: null,
            fastest_lap_rank: null,
            fastest_lap_number: null,
            fastest_lap_time_ms: null,
            points: "0.00",
            status: "DNF",
          },
        ])
      )
      .mockResolvedValueOnce({ rows: [] });

    const result = await findByRace("2025_R13");

    // No derivable position -> falls back to its row index (0) + 1, per the
    // ORDER BY position NULLS LAST in the query.
    expect(result?.classification[0]?.position).toBe(1);
    expect(result?.classification[0]?.status).toBe("DNF");
  });

  it("uses the stored fastest lap when a rank-1 row carries one", async () => {
    mocks.query
      .mockResolvedValueOnce(sessionRow("2025_R13_RACE"))
      .mockResolvedValueOnce(
        resultsRows([
          {
            position: 1,
            driver_id: "ANT",
            constructor_id: "MER",
            laps_completed: 44,
            pit_stops: 1,
            gap_to_winner_ms: 0,
            fastest_lap_rank: 1,
            fastest_lap_number: 32,
            fastest_lap_time_ms: 104861,
            points: "25.00",
            status: "FINISHED",
          },
        ])
      );

    const result = await findByRace("2025_R13");

    expect(result?.fastest_lap).toEqual({
      driver_id: "ANT",
      lap_number: 32,
      time_ms: 104861,
    });

    // Only 2 queries: session lookup + results. The laps-table fallback query
    // must not run when a stored fastest lap already exists.
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("falls back to the laps table when no stored fastest lap exists", async () => {
    mocks.query
      .mockResolvedValueOnce(sessionRow("2025_R13_RACE"))
      .mockResolvedValueOnce(
        resultsRows([
          {
            position: 1,
            driver_id: "PIA",
            constructor_id: "MCL",
            laps_completed: 44,
            pit_stops: 1,
            gap_to_winner_ms: 0,
            fastest_lap_rank: null,
            fastest_lap_number: null,
            fastest_lap_time_ms: null,
            points: "25.00",
            status: "FINISHED",
          },
        ])
      )
      .mockResolvedValueOnce({
        rows: [{ driver_id: "ANT", lap_number: 32, time_ms: 104861 }],
      });

    const result = await findByRace("2025_R13");

    expect(result?.fastest_lap).toEqual({
      driver_id: "ANT",
      lap_number: 32,
      time_ms: 104861,
    });
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });
});
