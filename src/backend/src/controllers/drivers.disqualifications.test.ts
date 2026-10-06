import { describe, expect, it } from "vitest";

import { disqualificationsFromSeason, type SeasonStatisticsData } from "./drivers.controller.js";
import type { RaceResultRow } from "../models/raceResults.model.js";
import type { Session } from "../types/session.types.js";

function session(round: number): Session {
  return {
    session_id: `2025_R${String(round).padStart(2, "0")}_RACE`,
    grand_prix_id: `2025_R${String(round).padStart(2, "0")}`,
    type: "RACE",
    total_laps: 50,
    start_time: null,
    end_time: null,
  } as Session;
}

function result(driver_id: string, status: RaceResultRow["status"]): RaceResultRow {
  return {
    position: 1,
    classified_position: status === "FINISHED" ? 1 : null,
    grid_position: 1,
    fastest_lap_rank: null,
    driver_id,
    constructor_id: "MCL",
    laps: 50,
    pit_stops: 1,
    gap_to_winner_ms: null,
    points: 0,
    status,
  };
}

function season(rows: Record<number, RaceResultRow[]>): SeasonStatisticsData {
  const raceSessions = Object.keys(rows).map((round) => session(Number(round)));
  return {
    season: "2025",
    raceSessions,
    qualifyingByGrandPrix: new Map(),
    lapsBySession: new Map(),
    eventsBySession: new Map(),
    classificationBySession: new Map(
      raceSessions.map((raceSession, index) => [
        raceSession.session_id,
        Object.values(rows)[index] ?? [],
      ])
    ),
  };
}

describe("disqualificationsFromSeason", () => {
  const data = season({
    1: [result("HAM", "DSQ"), result("NOR", "FINISHED")],
    2: [result("HAM", "DNF"), result("NOR", "FINISHED")],
    3: [result("HAM", "FINISHED"), result("NOR", "DSQ")],
    4: [result("ham", "DSQ")],
  });

  it("counts the races where the published status is DSQ, case-insensitively", () => {
    expect(disqualificationsFromSeason("HAM", data)).toBe(2);
    expect(disqualificationsFromSeason("NOR", data)).toBe(1);
  });

  it("does not count retirements as disqualifications", () => {
    expect(disqualificationsFromSeason("HAM", season({ 1: [result("HAM", "DNF")] }))).toBe(0);
  });

  it("is 0 for a driver with no results", () => {
    expect(disqualificationsFromSeason("VER", data)).toBe(0);
  });
});
