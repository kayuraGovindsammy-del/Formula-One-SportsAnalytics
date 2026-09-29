import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../config/database.js", () => ({
  getPool: () => ({ query: mocks.query }),
}));

import {
  findConstructors,
  findDrivers,
  findLaps,
  findRaces,
  findResults,
} from "./exports.model.js";

function lastCall(): { sql: string; values: unknown[] } {
  const call = mocks.query.mock.calls.at(-1);
  return { sql: String(call?.[0] ?? ""), values: call?.[1] ?? [] };
}

describe("exports.model — one unpaginated query per dataset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.query.mockResolvedValue({ rows: [] });
  });

  const cases = [
    { name: "findRaces", run: () => findRaces("2025") },
    { name: "findDrivers", run: () => findDrivers("2025") },
    { name: "findConstructors", run: () => findConstructors("2025") },
    { name: "findResults", run: () => findResults("2025") },
    { name: "findLaps", run: () => findLaps("2025") },
  ];

  for (const { name, run } of cases) {
    it(`${name} issues exactly one query, with no LIMIT or OFFSET`, async () => {
      await run();

      expect(mocks.query).toHaveBeenCalledTimes(1);
      const { sql, values } = lastCall();
      expect(sql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/);
      expect(values).toEqual(["2025"]);
    });
  }

  it("findRaces omits the season filter when none is given", async () => {
    await findRaces(undefined);

    const { sql, values } = lastCall();
    expect(sql).not.toContain("WHERE gp.season_id");
    expect(values).toEqual([]);
  });

  it("findDrivers without a season falls back to each driver's latest link", async () => {
    await findDrivers(undefined);

    const { sql, values } = lastCall();
    expect(sql).not.toContain("WHERE season_id");
    expect(sql).toContain("ORDER BY driver_id, season_id DESC");
    expect(values).toEqual([]);
  });

  it("findConstructors with a season also counts teams that only have results", async () => {
    await findConstructors("2025");

    const { sql } = lastCall();
    expect(sql).toContain("FROM driver_constructor_links");
    expect(sql).toContain("FROM race_results");
  });

  it("findConstructors without a season returns every constructor", async () => {
    await findConstructors(undefined);

    const { sql, values } = lastCall();
    expect(sql).not.toContain("WHERE");
    expect(values).toEqual([]);
  });

  it("findResults converts NUMERIC points strings to numbers", async () => {
    mocks.query.mockResolvedValueOnce({
      rows: [{ driver_id: "PIA", position: null, points: "12.50" }],
    });

    const rows = await findResults("2025");

    expect(rows).toEqual([{ driver_id: "PIA", position: null, points: 12.5 }]);
  });
});
