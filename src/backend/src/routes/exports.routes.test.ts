import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Fixtures are local rather than from sampleModelMocks.ts because the CSV
// assertions need a value that exercises RFC 4180 escaping — a comma and an
// embedded quote in the same field — which no real sample row contains.
const fixtures = vi.hoisted(() => ({
  races: [
    {
      grand_prix_id: "2025_R08",
      season_id: "2025",
      round: 8,
      race_name: 'Grand Prix de Monaco, the "Jewel"',
      circuit_id: "monaco",
      circuit_name: "Circuit de Monaco",
      locality: "Monte-Carlo",
      country: "Monaco",
      date: "2025-05-25",
      has_sprint: false,
      has_results: true,
    },
    {
      grand_prix_id: "2025_R13",
      season_id: "2025",
      round: 13,
      race_name: "Belgian Grand Prix",
      circuit_id: "spa",
      circuit_name: "Circuit de Spa-Francorchamps",
      locality: "Spa",
      country: "Belgium",
      date: "2025-07-27",
      has_sprint: true,
      has_results: false,
    },
  ],
  drivers: [
    {
      driver_id: "PIA",
      permanent_number: 81,
      given_name: "Oscar",
      family_name: "Piastri",
      nationality: "Australian",
      date_of_birth: "2001-04-06",
      constructor_id: "MCL",
      constructor_name: "McLaren",
    },
  ],
  constructors: [
    { constructor_id: "FER", name: "Ferrari", nationality: "Italian" },
    { constructor_id: "MCL", name: "McLaren", nationality: "British" },
    { constructor_id: "RB", name: "Racing Bulls", nationality: null },
  ],
  results: [
    {
      season_id: "2025",
      round: 13,
      grand_prix_id: "2025_R13",
      race_name: "Belgian Grand Prix",
      session_id: "2025_R13_RACE",
      session_type: "RACE",
      position: 1,
      driver_id: "PIA",
      constructor_id: "MCL",
      grid_position: 2,
      laps_completed: 44,
      pit_stops: 1,
      status: "FINISHED",
      points: 25,
      gap_to_winner_ms: 0,
      fastest_lap_rank: null,
      fastest_lap_number: null,
      fastest_lap_time_ms: null,
    },
  ],
  laps: [
    {
      season_id: "2025",
      round: 13,
      grand_prix_id: "2025_R13",
      session_id: "2025_R13_RACE",
      session_type: "RACE",
      driver_id: "PIA",
      lap_number: 1,
      lap_time_ms: 112345,
      position: 1,
      is_pit_lap: false,
      is_valid: true,
    },
    {
      season_id: "2025",
      round: 13,
      grand_prix_id: "2025_R13",
      session_id: "2025_R13_RACE",
      session_type: "RACE",
      driver_id: "PIA",
      lap_number: 2,
      lap_time_ms: null,
      position: 1,
      is_pit_lap: true,
      is_valid: false,
    },
  ],
}));

const model = vi.hoisted(() => ({
  findRaces: vi.fn(),
  findDrivers: vi.fn(),
  findConstructors: vi.fn(),
  findResults: vi.fn(),
  findLaps: vi.fn(),
}));

vi.mock("../models/exports.model.js", () => model);

import { createApp } from "../app.js";

const app = createApp();

const DATASETS = [
  { name: "races", fn: model.findRaces, rows: fixtures.races },
  { name: "drivers", fn: model.findDrivers, rows: fixtures.drivers },
  {
    name: "constructors",
    fn: model.findConstructors,
    rows: fixtures.constructors,
  },
  { name: "results", fn: model.findResults, rows: fixtures.results },
  { name: "laps", fn: model.findLaps, rows: fixtures.laps },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  model.findRaces.mockResolvedValue(fixtures.races);
  model.findDrivers.mockResolvedValue(fixtures.drivers);
  model.findConstructors.mockResolvedValue(fixtures.constructors);
  model.findResults.mockResolvedValue(fixtures.results);
  model.findLaps.mockResolvedValue(fixtures.laps);
});

describe("GET /api/v1/export/:dataset — every dataset, both formats", () => {
  for (const dataset of DATASETS) {
    it(`exports ${dataset.name} as JSON with a row_count`, async () => {
      const res = await request(app).get(
        `/api/v1/export/${dataset.name}?season=2025`
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^application\/json/);
      expect(res.body.data).toEqual(dataset.rows);
      expect(res.body.meta).toMatchObject({
        dataset: dataset.name,
        season: "2025",
        row_count: dataset.rows.length,
      });
      expect(dataset.fn).toHaveBeenCalledTimes(1);
      expect(dataset.fn).toHaveBeenCalledWith("2025");
    });

    it(`exports ${dataset.name} as CSV with a header row`, async () => {
      const res = await request(app).get(
        `/api/v1/export/${dataset.name}?season=2025&format=csv`
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["content-disposition"]).toBe(
        `attachment; filename="f1-${dataset.name}-2025.csv"`
      );

      const lines = res.text.split("\r\n");
      const firstRow = dataset.rows[0];
      expect(firstRow).toBeDefined();
      expect(lines[0]).toBe(Object.keys(firstRow ?? {}).join(","));
      // Header + one line per row + the empty string after the final CRLF.
      expect(lines).toHaveLength(dataset.rows.length + 2);
      expect(lines.at(-1)).toBe("");
    });
  }
});

describe("GET /api/v1/export/:dataset — JSON", () => {
  it("defaults to JSON when no format is given", async () => {
    const res = await request(app).get("/api/v1/export/races");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
  });

  it("reports meta for an unfiltered export", async () => {
    const res = await request(app).get("/api/v1/export/constructors");

    expect(res.body.meta.dataset).toBe("constructors");
    expect(res.body.meta.season).toBeNull();
    expect(res.body.meta.row_count).toBe(3);
    expect(Number.isNaN(Date.parse(res.body.meta.generated_at))).toBe(false);
    expect(model.findConstructors).toHaveBeenCalledWith(undefined);
  });

  it("reports row_count 0 and an empty array for an empty dataset", async () => {
    model.findLaps.mockResolvedValue([]);

    const res = await request(app).get("/api/v1/export/laps?season=1999");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.row_count).toBe(0);
  });

  it("sends JSON as an attachment too, so a cross-origin link downloads it", async () => {
    const res = await request(app).get("/api/v1/export/races?season=2025");

    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="f1-races-2025.json"'
    );
  });
});

describe("GET /api/v1/export/:dataset — CSV", () => {
  it("names an unfiltered export 'all'", async () => {
    const res = await request(app).get("/api/v1/export/drivers?format=csv");

    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="f1-drivers-all.csv"'
    );
  });

  it("writes the races header row in its documented column order", async () => {
    const res = await request(app).get("/api/v1/export/races?format=csv");

    expect(res.text.split("\r\n")[0]).toBe(
      "grand_prix_id,season_id,round,race_name,circuit_id,circuit_name," +
        "locality,country,date,has_sprint,has_results"
    );
  });

  it("quotes a value containing a comma and doubles its embedded quotes", async () => {
    const res = await request(app).get("/api/v1/export/races?format=csv");

    expect(res.text.split("\r\n")[1]).toBe(
      '2025_R08,2025,8,"Grand Prix de Monaco, the ""Jewel""",monaco,' +
        "Circuit de Monaco,Monte-Carlo,Monaco,2025-05-25,false,true"
    );
  });

  it("writes nulls as empty fields", async () => {
    const res = await request(app).get(
      "/api/v1/export/laps?season=2025&format=csv"
    );

    expect(res.text.split("\r\n")[2]).toBe(
      "2025,13,2025_R13,2025_R13_RACE,RACE,PIA,2,,1,true,false"
    );
  });

  it("still writes the header for an empty dataset", async () => {
    model.findResults.mockResolvedValue([]);

    const res = await request(app).get(
      "/api/v1/export/results?season=1999&format=csv"
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe(
      "season_id,round,grand_prix_id,race_name,session_id,session_type," +
        "position,driver_id,constructor_id,grid_position,laps_completed," +
        "pit_stops,status,points,gap_to_winner_ms,fastest_lap_rank," +
        "fastest_lap_number,fastest_lap_time_ms\r\n"
    );
  });
});

describe("GET /api/v1/export/:dataset — validation", () => {
  it("rejects an unknown dataset with VALIDATION_ERROR", async () => {
    const res = await request(app).get("/api/v1/export/pit_stops");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Unknown dataset 'pit_stops'. Expected one of: races, drivers, constructors, results, laps.",
      },
    });
  });

  it("rejects an unsupported format", async () => {
    const res = await request(app).get("/api/v1/export/races?format=xml");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("'format'");
    expect(model.findRaces).not.toHaveBeenCalled();
  });

  it("rejects a season that is not a four-digit year", async () => {
    const res = await request(app).get("/api/v1/export/races?season=twenty");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("'season'");
  });

  for (const name of ["results", "laps"] as const) {
    it(`requires a season for ${name}`, async () => {
      const res = await request(app).get(`/api/v1/export/${name}?format=csv`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid query parameter 'season': required for the '${name}' dataset`,
        },
      });
      expect(model.findResults).not.toHaveBeenCalled();
      expect(model.findLaps).not.toHaveBeenCalled();
    });

    it(`treats an empty season as missing for ${name}`, async () => {
      const res = await request(app).get(`/api/v1/export/${name}?season=`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  }

  it("does not require auth", async () => {
    const res = await request(app).get("/api/v1/export/drivers");

    expect(res.status).toBe(200);
  });
});
