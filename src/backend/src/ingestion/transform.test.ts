import { describe, expect, it } from "vitest";
import {
  buildSeasonIngestPlan,
  toClassifiedPosition,
  toConstructorId,
  toDriverId,
  toDriverRow,
  toRaceResultRows,
  toResultStatus,
} from "./transform.js";
import { jolpicaRaceSchema, type JolpicaRace } from "./jolpica.types.js";

/**
 * Fixtures are written in the wire format — every scalar a string — and
 * parsed through the real schema, so a test cannot accidentally assert
 * against a shape the API never sends.
 */
function race(raw: unknown): JolpicaRace {
  return jolpicaRaceSchema.parse(raw);
}

interface ResultOverrides {
  position?: string;
  positionText?: string;
  points?: string;
  status?: string;
  grid?: string;
  laps?: string;
  millis?: string;
  code?: string;
  driverId?: string;
  constructorId?: string;
  constructorName?: string;
  number?: string;
}

function resultFixture(overrides: ResultOverrides = {}): Record<string, unknown> {
  const time =
    overrides.millis === undefined ? undefined : { millis: overrides.millis, time: "x" };

  return {
    number: overrides.number ?? "4",
    position: overrides.position ?? "1",
    positionText: overrides.positionText ?? overrides.position ?? "1",
    points: overrides.points ?? "25",
    Driver: {
      driverId: overrides.driverId ?? "norris",
      code: overrides.code ?? "NOR",
      permanentNumber: "1",
      givenName: "Lando",
      familyName: "Norris",
      nationality: "British",
      dateOfBirth: "1999-11-13",
    },
    Constructor: {
      constructorId: overrides.constructorId ?? "mclaren",
      name: overrides.constructorName ?? "McLaren",
      nationality: "British",
    },
    grid: overrides.grid ?? "1",
    laps: overrides.laps ?? "57",
    status: overrides.status ?? "Finished",
    ...(time ? { Time: time } : {}),
  };
}

function raceFixture(
  round: string,
  results: Record<string, unknown>[],
  key: "Results" | "SprintResults" = "Results"
): JolpicaRace {
  return race({
    season: "2025",
    round,
    raceName: `Round ${round} Grand Prix`,
    Circuit: {
      circuitId: `circuit_${round}`,
      circuitName: `Circuit ${round}`,
      Location: { locality: "Town", country: "Country" },
    },
    date: "2025-03-16",
    [key]: results,
  });
}

describe("grand_prix_id — unpadded convention", () => {
  it("emits 2025_R1, not 2025_R01, for a single-digit round", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [raceFixture("1", [resultFixture()])],
    });

    expect(plan.grandPrix[0]?.grand_prix_id).toBe("2025_R1");
    expect(plan.sessions[0]?.session_id).toBe("2025_R1_RACE");
  });

  it("leaves a two-digit round unchanged", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [raceFixture("13", [resultFixture()])],
    });

    expect(plan.grandPrix[0]?.grand_prix_id).toBe("2025_R13");
    // The id database/seed.sql and data/sample/*.json already use.
    expect(plan.sessions[0]?.session_id).toBe("2025_R13_RACE");
  });
});

describe("toResultStatus", () => {
  it("maps Finished to FINISHED", () => {
    expect(toResultStatus("Finished", "1")).toBe("FINISHED");
  });

  it("treats Lapped as a finish, not a retirement", () => {
    expect(toResultStatus("Lapped", "12")).toBe("FINISHED");
  });

  it("maps the classic Ergast lapped spellings to FINISHED", () => {
    expect(toResultStatus("+1 Lap", "12")).toBe("FINISHED");
    expect(toResultStatus("+3 Laps", "15")).toBe("FINISHED");
  });

  it("maps Retired to DNF", () => {
    expect(toResultStatus("Retired", "R")).toBe("DNF");
  });

  it("maps Disqualified to DSQ", () => {
    expect(toResultStatus("Disqualified", "D")).toBe("DSQ");
  });

  it("folds 'Did not start' into DNF rather than a new status", () => {
    expect(toResultStatus("Did not start", "W")).toBe("DNF");
    expect(toResultStatus("did not start", "N")).toBe("DNF");
  });

  it("maps unknown mechanical retirements to DNF", () => {
    expect(toResultStatus("Engine", "R")).toBe("DNF");
    expect(toResultStatus("Collision damage", "R")).toBe("DNF");
  });

  it("trusts a numeric positionText when the status is unrecognised", () => {
    expect(toResultStatus("Some New Status", "7")).toBe("FINISHED");
  });
});

describe("toClassifiedPosition", () => {
  it("keeps the position for a classified finisher", () => {
    const row = raceFixture("1", [
      resultFixture({ position: "3", positionText: "3" }),
    ]);

    expect(toClassifiedPosition(row.Results?.[0] ?? never())).toBe(3);
  });

  it("nulls the position for a retirement so it cannot count as a podium", () => {
    const row = raceFixture("1", [
      resultFixture({ position: "3", positionText: "R", status: "Retired" }),
    ]);

    expect(toClassifiedPosition(row.Results?.[0] ?? never())).toBeNull();
  });
});

function never(): never {
  throw new Error("fixture is missing its result row");
}

describe("entity id mapping", () => {
  it("uses the three-letter code, which is what fits driver_id VARCHAR(10)", () => {
    expect(
      toDriverId({
        driverId: "max_verstappen",
        code: "VER",
        givenName: "Max",
        familyName: "Verstappen",
      })
    ).toBe("VER");
  });

  it("never exceeds the driver_id column width without a code", () => {
    const id = toDriverId({
      driverId: "some_extremely_long_driver_slug",
      givenName: "Someone",
      familyName: "Verylongfamilyname",
    });

    expect(id.length).toBeLessThanOrEqual(10);
  });

  it("maps Jolpica constructor slugs onto the codes already seeded", () => {
    expect(toConstructorId("red_bull")).toBe("RBR");
    expect(toConstructorId("mclaren")).toBe("MCL");
    expect(toConstructorId("sauber")).toBe("SAU");
  });

  it("falls back to a slug for an unknown constructor instead of throwing", () => {
    expect(toConstructorId("new_team_2027")).toBe("NEWTEAM2027");
  });

  it("prefers the season number over Jolpica's rewritten permanentNumber", () => {
    // Jolpica reports Norris's permanentNumber as 1 after the title; he
    // raced 4 in 2025, which is what seed.sql records.
    const row = toDriverRow(
      {
        driverId: "norris",
        code: "NOR",
        permanentNumber: 1,
        givenName: "Lando",
        familyName: "Norris",
      },
      4
    );

    expect(row.permanent_number).toBe(4);
  });
});

describe("toRaceResultRows", () => {
  it("takes points straight from Jolpica rather than deriving them", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [
        resultFixture({ position: "1", points: "25" }),
        resultFixture({ position: "2", points: "18", code: "VER" }),
      ]),
      "2025",
      "RACE"
    );

    expect(rows.map((row) => row.points)).toEqual([25, 18]);
  });

  it("preserves fractional points from a shortened race", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [resultFixture({ points: "12.5" })]),
      "2025",
      "RACE"
    );

    expect(rows[0]?.points).toBe(12.5);
  });

  it("captures grid_position", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [resultFixture({ grid: "7" })]),
      "2025",
      "RACE"
    );

    expect(rows[0]?.grid_position).toBe(7);
  });

  it("keeps a pit-lane start as grid 0, distinct from unknown", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [resultFixture({ grid: "0" })]),
      "2025",
      "RACE"
    );

    expect(rows[0]?.grid_position).toBe(0);
  });

  it("derives gap_to_winner_ms by subtracting absolute elapsed times", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [
        resultFixture({ position: "1", millis: "6126304" }),
        resultFixture({ position: "2", code: "VER", millis: "6127199" }),
      ]),
      "2025",
      "RACE"
    );

    expect(rows[0]?.gap_to_winner_ms).toBe(0);
    expect(rows[1]?.gap_to_winner_ms).toBe(895);
  });

  it("leaves gap null for a driver with no recorded time", () => {
    const rows = toRaceResultRows(
      raceFixture("1", [
        resultFixture({ position: "1", millis: "6126304" }),
        resultFixture({
          position: "18",
          positionText: "R",
          status: "Retired",
          code: "VER",
        }),
      ]),
      "2025",
      "RACE"
    );

    expect(rows[1]?.gap_to_winner_ms).toBeNull();
  });

  it("reads SprintResults for a SPRINT session and targets the sprint session id", () => {
    const rows = toRaceResultRows(
      raceFixture("13", [resultFixture({ points: "8" })], "SprintResults"),
      "2025",
      "SPRINT"
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.session_id).toBe("2025_R13_SPRINT");
    expect(rows[0]?.points).toBe(8);
  });

  it("returns nothing when the requested session has no results", () => {
    expect(toRaceResultRows(raceFixture("1", []), "2025", "SPRINT")).toEqual([]);
  });
});

describe("mid-season constructor changes", () => {
  const tsunodaAt = (round: string, constructorId: string) =>
    raceFixture(round, [
      resultFixture({
        code: "TSU",
        driverId: "tsunoda",
        constructorId,
        constructorName: constructorId,
      }),
    ]);

  it("resolves a driver to their most recent team that season", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [tsunodaAt("1", "rb"), tsunodaAt("3", "red_bull")],
    });

    expect(plan.driverConstructorLinks).toEqual([
      { season_id: "2025", driver_id: "TSU", constructor_id: "RBR" },
    ]);
  });

  it("is independent of the order the rounds arrive in", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [tsunodaAt("3", "red_bull"), tsunodaAt("1", "rb")],
    });

    expect(plan.driverConstructorLinks).toEqual([
      { season_id: "2025", driver_id: "TSU", constructor_id: "RBR" },
    ]);
  });

  it("emits exactly one link per driver even across many team changes", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        tsunodaAt("1", "rb"),
        tsunodaAt("2", "red_bull"),
        tsunodaAt("3", "alpine"),
      ],
    });

    expect(plan.driverConstructorLinks).toHaveLength(1);
    expect(plan.driverConstructorLinks[0]?.constructor_id).toBe("ALP");
  });

  it("still records the team the driver actually drove for in each race", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [tsunodaAt("1", "rb"), tsunodaAt("3", "red_bull")],
    });

    expect(plan.raceResults.map((row) => row.constructor_id)).toEqual([
      "RB",
      "RBR",
    ]);
  });

  it("lets a sprint round decide the most recent team when it is the latest", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [tsunodaAt("1", "rb")],
      sprintResults: [
        raceFixture(
          "6",
          [
            resultFixture({
              code: "TSU",
              driverId: "tsunoda",
              constructorId: "red_bull",
            }),
          ],
          "SprintResults"
        ),
      ],
    });

    expect(plan.driverConstructorLinks[0]?.constructor_id).toBe("RBR");
  });
});

describe("buildSeasonIngestPlan", () => {
  it("deduplicates circuits, drivers and constructors across rounds", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        raceFixture("1", [resultFixture()]),
        raceFixture("2", [resultFixture()]),
      ],
    });

    expect(plan.drivers).toHaveLength(1);
    expect(plan.constructors).toHaveLength(1);
    expect(plan.circuits).toHaveLength(2);
    expect(plan.grandPrix).toHaveLength(2);
    expect(plan.raceResults).toHaveLength(2);
  });

  it("applies the project's constructor names over Jolpica's", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        raceFixture("1", [
          resultFixture({ constructorId: "red_bull", constructorName: "Red Bull" }),
        ]),
      ],
    });

    expect(plan.constructors[0]).toMatchObject({
      constructor_id: "RBR",
      name: "Red Bull Racing",
    });
  });

  it("marks has_sprint from the calendar even when sprints are not ingested", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        raceFixture("1", [resultFixture()]),
        raceFixture("2", [resultFixture()]),
      ],
      sprintRounds: new Set([2]),
    });

    expect(plan.grandPrix.find((r) => r.round === 1)?.has_sprint).toBe(false);
    expect(plan.grandPrix.find((r) => r.round === 2)?.has_sprint).toBe(true);
  });

  it("records total_laps from the winner's lap count", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        raceFixture("1", [
          resultFixture({ position: "1", laps: "44" }),
          resultFixture({ position: "2", laps: "43", code: "VER" }),
        ]),
      ],
    });

    expect(plan.sessions[0]?.total_laps).toBe(44);
  });

  it("creates a grand_prix row for a scheduled round with no results yet", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [raceFixture("1", [])],
    });

    expect(plan.grandPrix).toHaveLength(1);
    expect(plan.sessions).toHaveLength(0);
    expect(plan.raceResults).toHaveLength(0);
  });

  it("warns when two Jolpica drivers collapse onto one driver_id", () => {
    const plan = buildSeasonIngestPlan({
      seasonId: "2025",
      raceResults: [
        raceFixture("1", [
          resultFixture({ code: "LEC", driverId: "leclerc" }),
          resultFixture({ code: "LEC", driverId: "arthur_leclerc" }),
        ]),
      ],
    });

    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("LEC");
  });

  it("rejects a non-numeric season", () => {
    expect(() =>
      buildSeasonIngestPlan({ seasonId: "not-a-year", raceResults: [] })
    ).toThrow(/four-digit year/);
  });

  it("is deterministic — the same input yields identical plans", () => {
    const input = {
      seasonId: "2025",
      raceResults: [
        raceFixture("2", [resultFixture({ code: "VER" })]),
        raceFixture("1", [resultFixture()]),
      ],
    };

    expect(buildSeasonIngestPlan(input)).toEqual(buildSeasonIngestPlan(input));
  });
});
