import { describe, expect, it, vi } from "vitest";
import type { RaceResultRow } from "../models/raceResults.model.js";
import type { Session } from "../types/session.types.js";

// A three-race season shaped like the real 2025 split: Verstappen has the
// most wins, Norris the most points. No laps or events, so every number comes
// from the published race_results rows, the shape of an ingested season.
const sessions: Session[] = [1, 2, 3].map((round) => ({
  session_id: `2025_R0${round}_RACE`,
  grand_prix_id: `2025_R0${round}`,
  type: "RACE",
  total_laps: 50,
  start_time: null,
  end_time: null,
})) as Session[];

function row(driver_id: string, constructor_id: string, place: number, points: number): RaceResultRow {
  return {
    position: place,
    classified_position: place,
    grid_position: place,
    fastest_lap_rank: null,
    driver_id,
    constructor_id,
    laps: 50,
    pit_stops: 1,
    gap_to_winner_ms: null,
    points,
    status: "FINISHED",
  };
}

const results = new Map<string, RaceResultRow[]>([
  ["2025_R01_RACE", [row("VER", "RBR", 1, 25), row("NOR", "MCL", 2, 18), row("PIA", "MCL", 3, 15)]],
  ["2025_R02_RACE", [row("VER", "RBR", 1, 25), row("NOR", "MCL", 2, 18), row("PIA", "MCL", 3, 15)]],
  ["2025_R03_RACE", [row("NOR", "MCL", 1, 25), row("PIA", "MCL", 2, 18), row("VER", "RBR", 9, 2)]],
]);
// Points: NOR 61, VER 52, PIA 48. Wins: VER 2, NOR 1, PIA 0.

vi.mock("../models/sessions.model.js", () => ({
  findBySeason: vi.fn(async () => sessions),
}));
vi.mock("../models/laps.model.js", () => ({
  findAllBySessions: vi.fn(async () => new Map()),
}));
vi.mock("../models/events.model.js", () => ({
  findAllBySessions: vi.fn(async () => new Map()),
}));
vi.mock("../models/raceResults.model.js", () => ({
  findClassificationsBySessions: vi.fn(async () => results),
}));
vi.mock("../models/names.model.js", () => ({
  findNameDirectory: vi.fn(async () => ({
    drivers: new Map([
      ["VER", "Max Verstappen"],
      ["NOR", "Lando Norris"],
      ["PIA", "Oscar Piastri"],
    ]),
    constructors: new Map([
      ["RBR", "Red Bull Racing"],
      ["MCL", "McLaren"],
    ]),
  })),
}));

import { loadDriverStandings } from "./drivers.controller.js";

describe("loadDriverStandings: the points ranking travels with every sort", () => {
  it("sorted by wins, still reports Norris as points leader and Verstappen 2nd on points", async () => {
    const result = await loadDriverStandings("2025", "wins", 10);

    expect(result.standings.map((r) => [r.position, r.driver_id, r.wins, r.points, r.points_position]))
      .toEqual([
        [1, "VER", 2, 52, 2],
        [2, "NOR", 1, 61, 1],
        [3, "PIA", 0, 48, 3],
      ]);
    expect(result.summary).toEqual({
      points_leader: {
        driver_id: "NOR",
        driver_name: "Lando Norris",
        team_name: "McLaren",
        points: 61,
        wins: 1,
      },
      wins_leader: {
        driver_id: "VER",
        driver_name: "Max Verstappen",
        team_name: "Red Bull Racing",
        points: 52,
        wins: 2,
      },
    });
  });

  it("keeps the summary for the whole field when the limit hides the leader", async () => {
    const result = await loadDriverStandings("2025", "wins", 1);

    expect(result.standings.map((r) => r.driver_id)).toEqual(["VER"]);
    expect(result.summary.points_leader?.driver_name).toBe("Lando Norris");
  });

  it("gives every sort the same points_position", async () => {
    const positionsBy = async (sort: "points" | "podiums" | "average_finish") =>
      Object.fromEntries(
        (await loadDriverStandings("2025", sort, 10)).standings.map((r) => [
          r.driver_id,
          r.points_position,
        ])
      );

    const expected = { NOR: 1, VER: 2, PIA: 3 };
    expect(await positionsBy("points")).toEqual(expected);
    expect(await positionsBy("podiums")).toEqual(expected);
    expect(await positionsBy("average_finish")).toEqual(expected);
  });
});
