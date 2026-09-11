import { describe, expect, it } from "vitest";
import { ingestSeasonPlan, writeSeasonPlan } from "./ingestSeason.js";
import { buildSeasonIngestPlan, type SeasonIngestPlan } from "./transform.js";
import { jolpicaRaceSchema } from "./jolpica.types.js";

interface RecordedQuery {
  text: string;
  values: readonly unknown[];
}

/**
 * A recording fake standing in for pg.PoolClient. The real SQL text runs
 * through it, so assertions are made against the statements that would
 * actually reach Postgres.
 */
function recordingClient() {
  const queries: RecordedQuery[] = [];

  return {
    queries,
    query: async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      return { rowCount: 1 };
    },
    release: () => undefined,
    /** Statements whose text mentions a table, normalised to one line. */
    forTable(table: string): RecordedQuery[] {
      return queries.filter((q) => q.text.includes(table));
    },
  };
}

function planFor(rounds: { round: string; constructorId?: string }[]) {
  return buildSeasonIngestPlan({
    seasonId: "2025",
    raceResults: rounds.map(({ round, constructorId }) =>
      jolpicaRaceSchema.parse({
        season: "2025",
        round,
        raceName: `Round ${round}`,
        Circuit: {
          circuitId: "spa",
          circuitName: "Circuit de Spa-Francorchamps",
          Location: { locality: "Spa", country: "Belgium" },
        },
        date: "2025-07-27",
        Results: [
          {
            number: "81",
            position: "1",
            positionText: "1",
            points: "25",
            Driver: {
              driverId: "piastri",
              code: "PIA",
              permanentNumber: "81",
              givenName: "Oscar",
              familyName: "Piastri",
              nationality: "Australian",
              dateOfBirth: "2001-04-06",
            },
            Constructor: {
              constructorId: constructorId ?? "mclaren",
              name: "McLaren",
              nationality: "British",
            },
            grid: "1",
            laps: "44",
            status: "Finished",
            Time: { millis: "5000000", time: "1:23:20.000" },
            FastestLap: {
              rank: "1",
              lap: "44",
              Time: { time: "1:44.701" },
            },
          },
        ],
      })
    ),
  });
}

describe("writeSeasonPlan", () => {
  it("upserts every entity on its primary key", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    for (const table of [
      "INTO seasons",
      "INTO circuits",
      "INTO constructors",
      "INTO drivers",
      "INTO grand_prix",
      "INTO sessions",
      "INTO race_results",
    ]) {
      const statements = client.forTable(table);

      expect(statements.length, table).toBeGreaterThan(0);
      expect(statements[0]?.text, table).toContain("ON CONFLICT");
    }
  });

  it("writes parents before the children that reference them", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    const indexOf = (needle: string) =>
      client.queries.findIndex((q) => q.text.includes(needle));

    // grand_prix -> circuits, sessions -> grand_prix,
    // race_results -> sessions + drivers + constructors.
    expect(indexOf("INTO circuits")).toBeLessThan(indexOf("INTO grand_prix"));
    expect(indexOf("INTO grand_prix")).toBeLessThan(indexOf("INTO sessions"));
    expect(indexOf("INTO sessions")).toBeLessThan(indexOf("INTO race_results"));
    expect(indexOf("INTO drivers")).toBeLessThan(indexOf("INTO race_results"));
    expect(indexOf("INTO constructors")).toBeLessThan(
      indexOf("INTO race_results")
    );
  });

  it("issues an identical statement sequence on a second run", async () => {
    const plan = planFor([{ round: "13" }]);

    const first = recordingClient();
    await writeSeasonPlan(first, plan);

    const second = recordingClient();
    await writeSeasonPlan(second, plan);

    expect(second.queries).toEqual(first.queries);
  });

  it("writes grid_position, points and fastest-lap metadata into race_results", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    const insert = client.forTable("INTO race_results")[0];

    expect(insert?.text).toContain("grid_position");
    expect(insert?.text).toContain("points");
    expect(insert?.text).toContain("fastest_lap_rank");
    expect(insert?.text).toContain("fastest_lap_number");
    expect(insert?.text).toContain("fastest_lap_time_ms");
    // session, driver, constructor, position, grid, points, laps, gap, fastest-lap fields, status
    expect(insert?.values).toEqual([
      "2025_R13_RACE",
      "PIA",
      "MCL",
      1,
      1,
      25,
      44,
      0,
      1,
      44,
      104701,
      "FINISHED",
    ]);
  });

  it("never overwrites pit_stops, which Jolpica does not report", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    const insert = client.forTable("INTO race_results")[0];
    const updateClause = insert?.text.split("DO UPDATE SET")[1] ?? "";

    // seed.sql and the derivation engine populate this column; an ingest
    // that wrote the column default would silently destroy those counts.
    expect(updateClause).not.toContain("pit_stops");
  });

  it("keeps an existing gap_to_winner_ms when the source has none", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    const insert = client.forTable("INTO race_results")[0];

    expect(insert?.text).toContain(
      "gap_to_winner_ms = COALESCE(EXCLUDED.gap_to_winner_ms, race_results.gap_to_winner_ms)"
    );
  });

  it("keeps existing fastest-lap metadata when the source omits it", async () => {
    const client = recordingClient();
    await writeSeasonPlan(client, planFor([{ round: "13" }]));

    const insert = client.forTable("INTO race_results")[0];

    expect(insert?.text).toContain(
      "fastest_lap_rank = COALESCE(EXCLUDED.fastest_lap_rank, race_results.fastest_lap_rank)"
    );
    expect(insert?.text).toContain(
      "fastest_lap_number = COALESCE(EXCLUDED.fastest_lap_number, race_results.fastest_lap_number)"
    );
    expect(insert?.text).toContain(
      "fastest_lap_time_ms = COALESCE(EXCLUDED.fastest_lap_time_ms, race_results.fastest_lap_time_ms)"
    );
  });

  it("clears a stale team link before inserting the resolved one", async () => {
    const client = recordingClient();
    await writeSeasonPlan(
      client,
      planFor([
        { round: "1", constructorId: "rb" },
        { round: "3", constructorId: "red_bull" },
      ])
    );

    const deletes = client.forTable("DELETE FROM driver_constructor_links");
    const inserts = client.forTable("INTO driver_constructor_links");

    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.values).toEqual(["2025", "PIA", "RBR"]);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values).toEqual(["2025", "PIA", "RBR"]);

    // Without the delete, a re-run after a transfer would leave both teams
    // linked, since the PK includes constructor_id.
    expect(client.queries.indexOf(deletes[0] as RecordedQuery)).toBeLessThan(
      client.queries.indexOf(inserts[0] as RecordedQuery)
    );
  });

  it("replaces only source pit stops and preserves reviewed submissions", async () => {
    const client = recordingClient();
    const plan = planFor([{ round: "13" }]);
    plan.pitStops.push({
      session_id: "2025_R13_RACE",
      driver_id: "PIA",
      lap_number: 20,
      duration_ms: 23213,
    });

    await writeSeasonPlan(client, plan);

    const deletes = client.forTable("DELETE FROM pit_stops");
    const inserts = client.forTable("INTO pit_stops");
    const countUpdates = client.forTable("UPDATE race_results rr");

    expect(deletes[0]?.text).toContain("submission_id IS NULL");
    expect(inserts[0]?.text).toContain("submission_id IS NOT NULL");
    expect(inserts[0]?.values).toEqual(["2025_R13_RACE", "PIA", 20, 23213]);
    expect(countUpdates).toHaveLength(1);
  });

  it("upserts derived retirements without overwriting reviewed submissions", async () => {
    const client = recordingClient();
    const plan = planFor([{ round: "13" }]);
    plan.retirements.push({
      session_id: "2025_R13_RACE",
      driver_id: "PIA",
      lap_number: 31,
      reason: "Retired",
    });

    await writeSeasonPlan(client, plan);

    const insert = client.forTable("INTO retirements")[0];
    expect(insert?.text).toContain("ON CONFLICT (session_id, driver_id)");
    expect(insert?.text).toContain("WHERE retirements.submission_id IS NULL");
    expect(insert?.values).toEqual(["2025_R13_RACE", "PIA", 31, "Retired"]);
  });

  it("reports counts matching the plan", async () => {
    const client = recordingClient();
    const plan = planFor([{ round: "1" }, { round: "13" }]);
    const counts = await writeSeasonPlan(client, plan);

    expect(counts).toEqual({
      seasons: 1,
      circuits: 1,
      grand_prix: 2,
      sessions: 2,
      drivers: 1,
      constructors: 1,
      driver_constructor_links: 1,
      race_results: 2,
      pit_stops: 0,
      retirements: 0,
    });
  });

  it("writes nothing but the season for an empty plan", async () => {
    const client = recordingClient();
    const empty: SeasonIngestPlan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [],
    });

    await writeSeasonPlan(client, empty);

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]?.text).toContain("INTO seasons");
  });
});

describe("ingestSeasonPlan", () => {
  it("commits the season as one transaction", async () => {
    const client = recordingClient();
    const counts = await ingestSeasonPlan(
      { connect: async () => client },
      planFor([{ round: "13" }])
    );

    expect(client.queries[0]?.text).toBe("BEGIN");
    expect(client.queries[client.queries.length - 1]?.text).toBe("COMMIT");
    expect(counts.race_results).toBe(1);
  });

  it("rolls back and releases the client on failure", async () => {
    const seen: string[] = [];
    let released = false;

    const failing = {
      query: async (text: string) => {
        seen.push(text);

        if (text.includes("INTO circuits")) {
          throw new Error("constraint violation");
        }

        return { rowCount: 1 };
      },
      release: () => {
        released = true;
      },
    };

    await expect(
      ingestSeasonPlan({ connect: async () => failing }, planFor([{ round: "13" }]))
    ).rejects.toThrow("constraint violation");

    expect(seen).toContain("ROLLBACK");
    expect(seen).not.toContain("COMMIT");
    expect(released).toBe(true);
  });
});
