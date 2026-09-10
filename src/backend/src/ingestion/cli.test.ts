import { describe, expect, it, vi } from "vitest";
import { UsageError, buildPlan, parseArgs, runIngest } from "./cli.js";
import { jolpicaRaceSchema, type JolpicaRace } from "./jolpica.types.js";

describe("parseArgs", () => {
  it("parses the documented invocation", () => {
    expect(parseArgs(["--season", "2025"])).toEqual({
      season: "2025",
      includeSprints: false,
      dryRun: false,
      refresh: false,
      cacheDir: undefined,
    });
  });

  it("accepts --season=2025", () => {
    expect(parseArgs(["--season=2025"]).season).toBe("2025");
  });

  it("keeps sprints opt-in", () => {
    expect(parseArgs(["--season", "2025"]).includeSprints).toBe(false);
    expect(
      parseArgs(["--season", "2025", "--include-sprints"]).includeSprints
    ).toBe(true);
  });

  it("parses the remaining flags", () => {
    const options = parseArgs([
      "--season",
      "2025",
      "--dry-run",
      "--refresh",
      "--cache-dir",
      "/tmp/cache",
    ]);

    expect(options).toMatchObject({
      dryRun: true,
      refresh: true,
      cacheDir: "/tmp/cache",
    });
  });

  it("requires a season", () => {
    expect(() => parseArgs([])).toThrow(UsageError);
    expect(() => parseArgs([])).toThrow(/--season is required/);
  });

  it("rejects a season that is not a four-digit year", () => {
    expect(() => parseArgs(["--season", "25"])).toThrow(/four-digit year/);
    expect(() => parseArgs(["--season", "twenty"])).toThrow(/four-digit year/);
  });

  it("rejects a --season with no value rather than eating the next flag", () => {
    expect(() => parseArgs(["--season", "--dry-run"])).toThrow(/requires a year/);
  });

  it("rejects an unknown flag instead of ignoring it", () => {
    expect(() => parseArgs(["--season", "2025", "--wat"])).toThrow(/Unknown argument/);
  });

  it("treats --help as a usage error carrying the usage text", () => {
    expect(() => parseArgs(["--help"])).toThrow(/Usage: npm run ingest/);
  });
});

function calendarRace(round: string, withSprint: boolean): JolpicaRace {
  const parsed = jolpicaRaceSchema.parse({
    season: "2025",
    round,
    raceName: `Round ${round}`,
    Circuit: {
      circuitId: `c${round}`,
      circuitName: `Circuit ${round}`,
      Location: { locality: "Town", country: "Country" },
    },
    date: "2025-03-16",
  });

  // The calendar carries a `Sprint` block the race schema does not model.
  return withSprint
    ? Object.assign(parsed, { Sprint: { date: "2025-03-15", time: "03:00:00Z" } })
    : parsed;
}

function resultsRace(round: string, key: "Results" | "SprintResults"): JolpicaRace {
  return jolpicaRaceSchema.parse({
    season: "2025",
    round,
    raceName: `Round ${round}`,
    Circuit: {
      circuitId: `c${round}`,
      circuitName: `Circuit ${round}`,
      Location: { locality: "Town", country: "Country" },
    },
    date: "2025-03-16",
    [key]: [
      {
        number: "4",
        position: "1",
        positionText: "1",
        points: key === "SprintResults" ? "8" : "25",
        Driver: {
          driverId: "norris",
          code: "NOR",
          givenName: "Lando",
          familyName: "Norris",
        },
        Constructor: { constructorId: "mclaren", name: "McLaren" },
        grid: "1",
        laps: "57",
        status: "Finished",
      },
    ],
  });
}

function fakeClient() {
  return {
    fetchSeasonResults: vi.fn(async () => [resultsRace("1", "Results"), resultsRace("2", "Results")]),
    fetchSeasonSprintResults: vi.fn(async () => [
      resultsRace("2", "SprintResults"),
    ]),
    fetchSeasonRaces: vi.fn(async () => [
      calendarRace("1", false),
      calendarRace("2", true),
    ]),
  };
}

const baseOptions = {
  season: "2025",
  includeSprints: false,
  dryRun: false,
  refresh: false,
  cacheDir: undefined,
};

describe("buildPlan", () => {
  it("does not fetch sprint results unless asked", async () => {
    const client = fakeClient();
    await buildPlan({ client, options: baseOptions });

    expect(client.fetchSeasonResults).toHaveBeenCalledTimes(1);
    expect(client.fetchSeasonSprintResults).not.toHaveBeenCalled();
  });

  it("sets has_sprint from the calendar even in races-only mode", async () => {
    const client = fakeClient();
    const plan = await buildPlan({ client, options: baseOptions });

    expect(plan.grandPrix.find((r) => r.round === 1)?.has_sprint).toBe(false);
    expect(plan.grandPrix.find((r) => r.round === 2)?.has_sprint).toBe(true);
    // ...but no SPRINT session is written.
    expect(plan.sessions.map((s) => s.type)).toEqual(["RACE", "RACE"]);
  });

  it("adds SPRINT sessions and their points under --include-sprints", async () => {
    const client = fakeClient();
    const plan = await buildPlan({
      client,
      options: { ...baseOptions, includeSprints: true },
    });

    expect(client.fetchSeasonSprintResults).toHaveBeenCalledTimes(1);
    expect(plan.sessions.map((s) => s.session_id)).toContain("2025_R2_SPRINT");

    const sprintRow = plan.raceResults.find(
      (row) => row.session_id === "2025_R2_SPRINT"
    );

    expect(sprintRow?.points).toBe(8);
  });
});

/** A recording stand-in for the transactional pool. */
function fakePool() {
  const statements: string[] = [];

  return {
    statements,
    connect: async () => ({
      query: async (text: string) => {
        statements.push(text);
        return { rowCount: 1 };
      },
      release: () => undefined,
    }),
  };
}

describe("runIngest", () => {
  it("fetches and maps but writes nothing on a dry run", async () => {
    const client = fakeClient();
    const pool = fakePool();
    const connect = vi.spyOn(pool, "connect");

    const report = await runIngest({
      options: { ...baseOptions, dryRun: true },
      pool,
      client,
      log: () => undefined,
    });

    expect(client.fetchSeasonResults).toHaveBeenCalledTimes(1);
    expect(report.plan.raceResults).toHaveLength(2);
    expect(report.counts).toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it("writes the plan in a transaction on a real run", async () => {
    const pool = fakePool();

    const report = await runIngest({
      options: baseOptions,
      pool,
      client: fakeClient(),
      log: () => undefined,
    });

    expect(report.counts?.race_results).toBe(2);
    expect(pool.statements[0]).toBe("BEGIN");
    expect(pool.statements).toContain("COMMIT");
  });

  it("reports the plan and any warnings to the log", async () => {
    const lines: string[] = [];

    await runIngest({
      options: { ...baseOptions, dryRun: true },
      pool: fakePool(),
      client: fakeClient(),
      log: (message) => lines.push(message),
    });

    const output = lines.join("\n");

    expect(output).toContain("races only");
    expect(output).toContain("race_results             2");
    expect(output).toContain("Dry run");
  });
});
