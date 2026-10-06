import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QualifyingData } from "../models/qualifyingResults.model.js";

const mocks = vi.hoisted(() => ({
  findQualifying: vi.fn<(grandPrixId: string) => Promise<QualifyingData>>(),
}));

vi.mock("../models/drivers.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findAll: fixtures.findAllDrivers,
    findById: fixtures.findDriverById,
    getConstructorIdByDriver: fixtures.getConstructorIdByDriver,
  };
});

vi.mock("../models/constructors.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return {
    findById: fixtures.findConstructorById,
    findSeasonPointRows: fixtures.findSeasonPointRows,
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
    findByRace: vi.fn(fixtures.findEventsByRace),
  };
});

vi.mock("../models/names.model.js", async () => {
  const fixtures = await import("../test/sampleModelMocks.js");
  return { findNameDirectory: fixtures.findNameDirectory };
});

vi.mock("../models/qualifyingResults.model.js", () => ({
  findByRace: mocks.findQualifying,
}));

import { loadDriverStatistics } from "../controllers/drivers.controller.js";
import * as eventsModel from "../models/events.model.js";
import type { Event } from "../types/event.types.js";
import {
  DEFAULT_SEASON,
  MAX_EVENT_EXAMPLES,
  MAX_EVENTS_SUMMARISED,
  MAX_TOOL_OUTPUT_CHARS,
  TOOL_DEFINITIONS,
  decimalsFor,
  formatDuration,
  formatToolOutput,
  humanizeDurations,
  isToolName,
  runTool,
} from "./tools.js";

const context = { apiBaseUrl: "http://localhost:3001/api/v1" };

async function call(name: string, args: unknown) {
  const result = await runTool(name, JSON.stringify(args), context);
  return { ...result, body: JSON.parse(result.content) as Record<string, unknown> };
}

beforeEach(() => {
  mocks.findQualifying.mockReset();
  mocks.findQualifying.mockResolvedValue({ session_id: null, classification: [] });
});

describe("tool definitions", () => {
  it("offers exactly the whitelisted tools", () => {
    const names = TOOL_DEFINITIONS.map((definition) => definition.function.name);

    expect(names).toEqual([
      "search_drivers",
      "search_races",
      "get_driver_stats",
      "get_driver_standings",
      "get_constructor_standings",
      "get_race_summary",
      "get_race_events",
      "get_export_link",
    ]);
    expect(names.every(isToolName)).toBe(true);
  });
});

describe("runTool: dispatch and validation", () => {
  it("returns an error message for an unknown tool instead of throwing", async () => {
    const result = await call("drop_tables", {});

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/^Unknown tool 'drop_tables'/);
  });

  it("does not treat inherited object keys as tools", async () => {
    expect((await call("constructor", {})).ok).toBe(false);
    expect((await call("toString", {})).ok).toBe(false);
  });

  it("returns an error message for arguments that are not JSON", async () => {
    const result = await runTool("search_drivers", "{not json", context);

    expect(result.ok).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      error: "Arguments must be a JSON object.",
    });
  });

  it("returns an error message for missing or invalid arguments", async () => {
    const missing = await call("search_drivers", {});
    expect(missing.ok).toBe(false);
    expect(missing.body.error).toMatch(/^Invalid arguments for search_drivers: query/);

    const badType = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "LAP_COMPLETED",
    });
    expect(badType.ok).toBe(false);
    expect(badType.body.error).toMatch(/type/);
  });

  it("rejects arguments the tool does not declare", async () => {
    const result = await call("get_constructor_standings", {
      season: "2025",
      sql: "DROP TABLE drivers",
    });

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/sql/);
  });
});

describe("season handling", () => {
  it("defaults to the app's season when none is given", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA" });

    expect(DEFAULT_SEASON).toBe("2025");
    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
  });

  it("accepts a season sent as a number", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA", season: 2025 });

    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
  });

  it("applies the four-digit rule from the stats endpoints", async () => {
    for (const season of ["abc", "25", "2025a"]) {
      const result = await call("get_driver_stats", { driver_id: "PIA", season });

      expect(result.ok).toBe(false);
      expect(result.body.error).toMatch(/season: Expected a four-digit season/);
    }
  });
});

describe("search tools", () => {
  it("finds drivers by name", async () => {
    const result = await call("search_drivers", { query: "piastri" });

    expect(result.ok).toBe(true);
    expect(result.body.drivers).toEqual([
      expect.objectContaining({ driver_id: "PIA", name: "Oscar Piastri" }),
    ]);
  });

  it("lists a season's races when no query is given", async () => {
    const result = await call("search_races", {});

    expect(result.ok).toBe(true);
    expect(result.body.season).toBe("2025");
    expect(result.body.races).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ grand_prix_id: "2025_R13", has_results: true }),
      ])
    );
  });
});

describe("get_driver_stats", () => {
  it("returns what GET /drivers/:id/stats returns, with durations in seconds", async () => {
    const result = await call("get_driver_stats", { driver_id: "PIA", season: "2025" });

    expect(result.body).toEqual(
      JSON.parse(JSON.stringify(humanizeDurations(await loadDriverStatistics("PIA", "2025"))))
    );
    expect(result.body).not.toHaveProperty("average_race_pace_ms");
    expect(result.body.average_race_pace).toMatch(/^\d+\.\d{3} s$/);
  });

  it("tells the model when a driver does not exist", async () => {
    const result = await call("get_driver_stats", { driver_id: "ZZZ" });

    expect(result.ok).toBe(false);
    expect(result.body.error).toBe(
      "Driver 'ZZZ' was not found. Use search_drivers to find the driver_id."
    );
  });
});

describe("get_driver_standings", () => {
  type Row = Record<string, unknown> & { driver_id: string };

  it("ranks drivers by points by default, with names and teams", async () => {
    const result = await call("get_driver_standings", {});
    const standings = result.body.standings as Row[];

    expect(result.ok).toBe(true);
    expect(result.body).toMatchObject({ season: "2025", sort_by: "points" });
    expect(standings.length).toBeGreaterThan(1);
    expect(standings[0]).toMatchObject({
      position: 1,
      driver_id: "PIA",
      driver_name: "Oscar Piastri",
      constructor_id: "MCL",
      team_name: "McLaren",
    });
    const points = standings.map((row) => row.points as number);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("matches get_driver_stats for every driver it lists", async () => {
    const { body } = await call("get_driver_standings", { limit: 25 });

    for (const row of body.standings as Row[]) {
      const own = await call("get_driver_stats", { driver_id: row.driver_id });
      expect(row).toMatchObject({
        points: own.body.points,
        wins: own.body.wins,
        podiums: own.body.podiums,
        fastest_laps: own.body.fastest_laps,
        dnfs: own.body.dnf_count,
        average_finish_position: own.body.average_finish_position,
        races_entered: own.body.races_entered,
      });
    }
  });

  it("sorts by another statistic and honours the limit", async () => {
    const result = await call("get_driver_standings", { sort_by: "average_finish", limit: "3" });
    const standings = result.body.standings as Row[];

    expect(result.body.sort_by).toBe("average_finish");
    expect(standings).toHaveLength(3);
    expect(standings[0]?.average_finish_position).toBe(1);
  });

  it("rejects an unknown sort or an out-of-range limit", async () => {
    expect((await call("get_driver_standings", { sort_by: "style" })).ok).toBe(false);
    expect((await call("get_driver_standings", { limit: 0 })).ok).toBe(false);
    expect((await call("get_driver_standings", { limit: 26 })).ok).toBe(false);
  });

  it("says when a season has no results", async () => {
    const result = await call("get_driver_standings", { season: "1999" });

    expect(result.body).toMatchObject({
      total_drivers: 0,
      standings: [],
      note: "No race results are stored for 1999.",
    });
  });
});

describe("get_constructor_standings", () => {
  it("ranks constructors by summed points", async () => {
    const result = await call("get_constructor_standings", {});
    const standings = result.body.standings as Array<Record<string, unknown>>;

    expect(result.ok).toBe(true);
    expect(standings[0]).toEqual({ position: 1, constructor_id: "MCL", points: 43 });
  });

  it("notes when a season has no results rather than inventing a table", async () => {
    const result = await call("get_constructor_standings", { season: "1999" });

    expect(result.body).toEqual({
      season: "1999",
      standings: [],
      note: "No race results are stored for 1999.",
    });
  });
});

describe("get_race_summary", () => {
  it("combines race details, statistics and qualifying", async () => {
    mocks.findQualifying.mockResolvedValue({
      session_id: "2025_R13_QUALIFYING",
      classification: [
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
      ],
    });

    const result = await call("get_race_summary", { grand_prix_id: "2025_R13" });

    expect(result.ok).toBe(true);
    expect(result.body.race).toMatchObject({ grand_prix_id: "2025_R13", season: "2025" });
    expect(result.body.lap_data_available).toBe(true);
    expect(result.body.note).toBeUndefined();
    expect(result.body.statistics).toMatchObject({ grand_prix_id: "2025_R13" });
    expect(result.body.qualifying).toEqual([
      expect.objectContaining({
        position: 1,
        driver_id: "NOR",
        q1_time: "64.962 s",
        q2_time: "64.634 s",
        q3_time: "63.971 s",
      }),
    ]);
    expect(result.content).not.toMatch(/_ms"/);
    expect(mocks.findQualifying).toHaveBeenCalledWith("2025_R13");
  });

  it("flags a race without lap data so zeros are not read as facts", async () => {
    // 2025_R01 exists but has no sessions in the sample data.
    const result = await call("get_race_summary", { grand_prix_id: "2025_R01" });

    expect(result.ok).toBe(true);
    expect(result.body.lap_data_available).toBe(false);
    expect(result.body.statistics).toBeNull();
    expect(result.body.note).toMatch(/No lap-by-lap data/);
  });

  it("tells the model when a race does not exist", async () => {
    const result = await call("get_race_summary", { grand_prix_id: "2025_R99" });

    expect(result.ok).toBe(false);
    expect(result.body.error).toBe(
      "Race '2025_R99' was not found. Use search_races to find the grand_prix_id."
    );
    expect(mocks.findQualifying).not.toHaveBeenCalled();
  });
});

describe("get_race_events", () => {
  const pitStop = (n: number, lap: number, durationMs: number): Event => ({
    event_id: `evt_${n}`,
    session_id: "2025_R13_RACE",
    driver_id: `D${String(n).padStart(2, "0")}`,
    type: "PIT_STOP",
    lap_number: lap,
    timestamp: null,
    payload: { duration_ms: durationMs },
  });

  it("summarises instead of listing: total, fastest stop, busiest laps, 8 examples", async () => {
    // 40 stops; the fastest (19.95 s, shown as 20.0 s) is on lap 28; laps 16-20 are busiest.
    const rows = Array.from({ length: 40 }, (_, n) => {
      const lap = n < 20 ? 16 + (n % 5) : 21 + (n % 20);
      return pitStop(n, lap, n === 27 ? 19_950 : 23_312 + n);
    });
    vi.mocked(eventsModel.findByRace).mockResolvedValueOnce({ rows, total_items: 40 });

    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "PIT_STOP",
    });

    expect(result.ok).toBe(true);
    expect(eventsModel.findByRace).toHaveBeenLastCalledWith("2025_R13", {
      page: 1,
      per_page: MAX_EVENTS_SUMMARISED,
      type: "PIT_STOP",
      driver_id: undefined,
      session_type: "RACE",
    });

    const examples = result.body.examples as Array<Record<string, unknown>>;
    expect(MAX_EVENT_EXAMPLES).toBe(8);
    expect(examples).toHaveLength(8);
    expect(examples[0]).toEqual({ driver_id: "D00", lap: 16, duration: "23.3 s" });

    expect(result.body).toMatchObject({
      total_events: 40,
      fastest_pit_stop: { driver_id: "D27", lap: 28, duration: "20.0 s" },
      busiest_laps: { from_lap: 16, to_lap: 20, count: 20 },
      full_list_url:
        "http://localhost:3001/api/v1/races/2025_R13/events?type=PIT_STOP&per_page=100",
      note: "Showing 8 of 40 pit stops. The full list is at full_list_url, or ask about a specific driver.",
    });
    expect(result.content).not.toMatch(/_ms"/);
  });

  it("returns every event, with no note, when there are 8 or fewer", async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "POSITION_CHANGE",
    });
    const examples = result.body.examples as Array<Record<string, unknown>>;

    expect(result.ok).toBe(true);
    expect(result.body.total_events).toBe(examples.length);
    expect(examples.length).toBeGreaterThan(0);
    expect(result.body.note).toBeUndefined();
    // Only pit stops have a "fastest".
    expect(result.body.fastest_pit_stop).toBeUndefined();
  });

  it("says when the summary covers only part of a very long list", async () => {
    vi.mocked(eventsModel.findByRace).mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, n) => pitStop(n, n + 1, 22_000)),
      total_items: 900,
    });

    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "PIT_STOP",
    });

    expect(result.body.note).toMatch(/The summary covers the first 10 pit stops only\.$/);
  });

  it("filters by driver and links to that driver's full list", async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R13",
      type: "PIT_STOP",
      driver_id: "PIA",
    });
    const examples = result.body.examples as Array<{ driver_id?: string; duration?: string }>;

    expect(result.ok).toBe(true);
    expect(result.body.driver_id).toBe("PIA");
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((event) => event.driver_id === "PIA")).toBe(true);
    expect(examples.every((event) => /^\d+\.\d s$/.test(event.duration ?? ""))).toBe(true);
    expect(result.body.full_list_url).toBe(
      "http://localhost:3001/api/v1/races/2025_R13/events?type=PIT_STOP&per_page=100&driver_id=PIA"
    );
  });

  it("tells the model when a race does not exist", async () => {
    const result = await call("get_race_events", {
      grand_prix_id: "2025_R99",
      type: "PIT_STOP",
    });

    expect(result.ok).toBe(false);
    expect(result.body.error).toMatch(/^Race '2025_R99' was not found/);
  });
});

describe("get_export_link", () => {
  it("builds an absolute /export URL with the default season", async () => {
    const result = await call("get_export_link", { dataset: "results", format: "csv" });

    expect(result.body).toEqual({
      dataset: "results",
      format: "csv",
      season: "2025",
      url: "http://localhost:3001/api/v1/export/results?format=csv&season=2025",
    });
  });

  it("rejects a dataset that does not exist", async () => {
    const result = await call("get_export_link", { dataset: "users", format: "csv" });

    expect(result.ok).toBe(false);
  });
});

describe("duration conversion", () => {
  it("formats stop durations with one decimal", () => {
    expect(formatDuration(23_312)).toBe("23.3 s");
    expect(formatDuration(23_350)).toBe("23.4 s");
    expect(formatDuration(2_049)).toBe("2.0 s");
    expect(formatDuration(0)).toBe("0.0 s");
  });

  it("formats lap and qualifying times with three decimals", () => {
    expect(formatDuration(64_012, 3)).toBe("64.012 s");
    expect(formatDuration(83_456, 3)).toBe("83.456 s");
    expect(formatDuration(64_000, 3)).toBe("64.000 s");
    expect(formatDuration(812, 3)).toBe("0.812 s");
  });

  it("uses one decimal only for stop and penalty durations", () => {
    expect(decimalsFor("duration_ms")).toBe(1);
    expect(decimalsFor("total_pit_time_ms")).toBe(1);
    for (const key of [
      "lap_time_ms",
      "fastest_lap_time_ms",
      "time_ms",
      "q1_time_ms",
      "q3_time_ms",
      "average_race_pace_ms",
      "consistency_ms",
      "gap_to_winner_ms",
      "some_future_ms",
    ]) {
      expect(decimalsFor(key)).toBe(3);
    }
  });

  it("keeps a qualifying gap below 0.1 s visible", () => {
    expect(
      humanizeDurations([
        { driver_id: "NOR", q3_time_ms: 63_971 },
        { driver_id: "PIA", q3_time_ms: 64_012 },
      ])
    ).toEqual([
      { driver_id: "NOR", q3_time: "63.971 s" },
      { driver_id: "PIA", q3_time: "64.012 s" },
    ]);
  });

  it("renames every *_ms number at any depth and keeps nulls", () => {
    expect(
      humanizeDurations({
        lap_time_ms: 83_456,
        gap_to_winner_ms: null,
        position: 1,
        fastest_lap: { driver_id: "NOR", lap_time_ms: 63_971 },
        stops: [{ duration_ms: 23_312 }, { duration_ms: 2_400 }],
      })
    ).toEqual({
      lap_time: "83.456 s",
      gap_to_winner: null,
      position: 1,
      fastest_lap: { driver_id: "NOR", lap_time: "63.971 s" },
      stops: [{ duration: "23.3 s" }, { duration: "2.4 s" }],
    });
  });

  it("leaves non-numeric *_ms fields and other values alone", () => {
    expect(humanizeDurations({ note_ms: "n/a", items: 3, label: "x" })).toEqual({
      note_ms: "n/a",
      items: 3,
      label: "x",
    });
  });
});

describe("formatToolOutput", () => {
  it("passes small output through unchanged", () => {
    expect(formatToolOutput({ a: 1 })).toBe('{"a":1}');
  });

  it("cuts large output to the limit and says so", () => {
    const text = formatToolOutput({ rows: "x".repeat(MAX_TOOL_OUTPUT_CHARS * 2) });

    expect(text.length).toBeLessThan(MAX_TOOL_OUTPUT_CHARS + 100);
    expect(text).toMatch(/\[truncated: output exceeded \d+ characters\]$/);
  });
});
