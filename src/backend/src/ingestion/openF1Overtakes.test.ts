import { describe, expect, it } from "vitest";
import {
  buildOvertakeIngestPlan,
  lapNumberAtTime,
  matchRaceSessions,
  toPositionChangeRows,
  writePositionChanges,
  type OpenF1Lap,
  type OpenF1Overtake,
  type OpenF1RaceSession,
} from "./openF1Overtakes.js";

const sessions: OpenF1RaceSession[] = [
  {
    session_key: 100,
    meeting_key: 10,
    session_name: "Race",
    session_type: "Race",
    date_start: "2025-03-16T04:00:00+00:00",
    date_end: "2025-03-16T06:00:00+00:00",
    year: 2025,
  },
  {
    // UTC date is one day after the DB's local race_date.
    session_key: 200,
    meeting_key: 20,
    session_name: "Race",
    session_type: "Race",
    date_start: "2025-11-23T04:00:00+00:00",
    date_end: "2025-11-23T06:00:00+00:00",
    year: 2025,
  },
];

const laps: OpenF1Lap[] = [
  { session_key: 100, driver_number: 4, lap_number: 1, date_start: "2025-03-16T04:03:00+00:00" },
  { session_key: 100, driver_number: 4, lap_number: 2, date_start: "2025-03-16T04:05:00+00:00" },
  { session_key: 100, driver_number: 4, lap_number: 3, date_start: "2025-03-16T04:07:00+00:00" },
];

describe("matchRaceSessions", () => {
  it("matches exact dates and one-day UTC rollover races", () => {
    const matched = matchRaceSessions(
      [
        { session_id: "2025_R01_RACE", race_date: "2025-03-16" },
        { session_id: "2025_R22_RACE", race_date: "2025-11-22" },
      ],
      sessions
    );

    expect(matched.get("2025_R01_RACE")?.session_key).toBe(100);
    expect(matched.get("2025_R22_RACE")?.session_key).toBe(200);
  });
});

describe("lapNumberAtTime", () => {
  it("uses the latest started lap at the overtake timestamp", () => {
    expect(lapNumberAtTime(laps, 4, "2025-03-16T04:06:15+00:00")).toBe(2);
  });

  it("returns null when the driver has no lap timing", () => {
    expect(lapNumberAtTime(laps, 81, "2025-03-16T04:06:15+00:00")).toBeNull();
  });
});

describe("toPositionChangeRows", () => {
  it("maps an OpenF1 exchange into the existing POSITION_CHANGE shape", () => {
    const overtakes: OpenF1Overtake[] = [
      {
        date: "2025-03-16T04:06:15+00:00",
        meeting_key: 10,
        session_key: 100,
        overtaking_driver_number: 4,
        overtaken_driver_number: 81,
        position: 1,
      },
    ];
    const warnings: string[] = [];
    const rows = toPositionChangeRows(
      "2025_R01_RACE",
      overtakes,
      laps,
      new Map([
        [4, "NOR"],
        [81, "PIA"],
      ]),
      warnings
    );

    expect(rows).toEqual([
      {
        session_id: "2025_R01_RACE",
        driver_id: "NOR",
        overtaken_driver_id: "PIA",
        lap_number: 2,
        position_before: 2,
        position_after: 1,
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it("skips an event whose car number cannot be mapped", () => {
    const warnings: string[] = [];
    const rows = toPositionChangeRows(
      "2025_R01_RACE",
      [{
        date: "2025-03-16T04:06:15+00:00",
        meeting_key: 10,
        session_key: 100,
        overtaking_driver_number: 4,
        overtaken_driver_number: 99,
        position: 3,
      }],
      laps,
      new Map([[4, "NOR"]]),
      warnings
    );

    expect(rows).toEqual([]);
    expect(warnings).toHaveLength(1);
  });
});

describe("writePositionChanges", () => {
  it("replaces only source rows and protects reviewed submission rows", async () => {
    const queries: { text: string; values?: readonly unknown[] }[] = [];
    const client = {
      query: async (text: string, values?: readonly unknown[]) => {
        queries.push({ text, values });
        return { rows: [], rowCount: text.includes("INSERT INTO position_changes") ? 1 : 0 };
      },
    };

    const inserted = await writePositionChanges(client, 2025, [{
      session_id: "2025_R01_RACE",
      driver_id: "NOR",
      overtaken_driver_id: "PIA",
      lap_number: 2,
      position_before: 2,
      position_after: 1,
    }]);

    expect(queries[0]?.text).toBe("BEGIN");
    expect(queries.some((query) =>
      query.text.includes("DELETE FROM position_changes") &&
      query.text.includes("submission_id IS NULL")
    )).toBe(true);
    expect(queries.some((query) =>
      query.text.includes("INSERT INTO position_changes") &&
      query.text.includes("submission_id IS NOT NULL")
    )).toBe(true);
    expect(queries.at(-1)?.text).toBe("COMMIT");
    expect(inserted).toBe(1);
  });
});


describe("buildOvertakeIngestPlan", () => {
  it("reports raw, converted, and skipped counts per race", async () => {
    const client = {
      fetchRaceSessions: async () => [sessions[0]!],
      fetchOvertakes: async () => [
        {
          date: "2025-03-16T04:06:15+00:00",
          meeting_key: 10,
          session_key: 100,
          overtaking_driver_number: 4,
          overtaken_driver_number: 81,
          position: 1,
        },
        {
          date: "2025-03-16T04:06:20+00:00",
          meeting_key: 10,
          session_key: 100,
          overtaking_driver_number: 4,
          overtaken_driver_number: 99,
          position: 2,
        },
      ],
      fetchLaps: async () => laps,
    };

    const plan = await buildOvertakeIngestPlan(
      client,
      2025,
      [{ session_id: "2025_R01_RACE", race_date: "2025-03-16" }],
      [
        { driver_id: "NOR", permanent_number: 4 },
        { driver_id: "PIA", permanent_number: 81 },
      ]
    );

    expect(plan.raceSummaries).toEqual([
      {
        session_id: "2025_R01_RACE",
        openf1_session_key: 100,
        raw_overtakes: 2,
        converted_rows: 1,
        skipped_rows: 1,
      },
    ]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.warnings).toHaveLength(1);
  });
});
