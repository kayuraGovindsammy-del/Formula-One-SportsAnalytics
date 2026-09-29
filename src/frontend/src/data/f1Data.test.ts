import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  fetchConstructorStatistics,
  fetchDriver,
  fetchDrivers,
  fetchRace,
  fetchRaces,
} from "./f1Data";

function mockFetchResponse(options: {
  ok: boolean;
  status?: number;
  body: unknown;
}) {
  return vi.fn().mockResolvedValue({
    ok: options.ok,
    status: options.status ?? 200,
    json: async () => options.body,
  });
}

describe("fetchConstructorStatistics", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("maps a successful response to camelCase fields", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            constructor_id: "ferrari",
            season: "2025",
            points: 320,
          },
        },
      })
    );

    const result = await fetchConstructorStatistics("ferrari", "2025");

    expect(result).toEqual({
      constructorId: "ferrari",
      season: "2025",
      points: 320,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/constructors/ferrari/stats?season=2025"
      )
    );
  });

  test("URL-encodes a constructor ID with special characters", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            constructor_id: "team/x",
            season: "2025",
            points: 10,
          },
        },
      })
    );

    await fetchConstructorStatistics("team/x", "2025");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/constructors/team%2Fx/stats")
    );
  });

  test("defaults to the 2025 season when none is given", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            constructor_id: "mclaren",
            season: "2025",
            points: 50,
          },
        },
      })
    );

    await fetchConstructorStatistics("mclaren");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("season=2025")
    );
  });

  test("rejects with the API's error message on a 404", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: false,
        status: 404,
        body: { error: "Constructor not found." },
      })
    );

    await expect(
      fetchConstructorStatistics("unknown")
    ).rejects.toThrow("Constructor not found.");
  });

  test("falls back to a generic message on a 404 with no error body", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: false,
        status: 404,
        body: {},
      })
    );

    await expect(
      fetchConstructorStatistics("unknown")
    ).rejects.toThrow(
      "API request failed with status 404."
    );
  });
});

describe("driver and race normalization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetchDriver maps API fields to a Driver", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            driver_id: "ver",
            permanent_number: 1,
            given_name: "Max",
            family_name: "Verstappen",
            nationality: "NED",
            date_of_birth: "1997-09-30",
            constructor_id: "RBR",
            constructor_name: "Red Bull Racing",
          },
        },
      })
    );

    const driver = await fetchDriver("ver");

    expect(driver).toEqual({
      driverId: "ver",
      number: 1,
      name: "Max Verstappen",
      team: "Red Bull Racing",
      constructorId: "RBR",
      nationality: "NED",
      dateOfBirth: "1997-09-30",
    });
  });

  test("fetchRaces maps API fields and defaults hasResults to false when absent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: [
            {
              grand_prix_id: "gp1",
              season_id: "2025",
              round: 1,
              race_name: "Australian Grand Prix",
              circuit_id: "albert_park",
              circuit_name: "Albert Park Circuit",
              locality: "Melbourne",
              country: "Australia",
              date: "2025-03-16",
              has_sprint: false,
            },
          ],
        },
      })
    );

    const [race] = await fetchRaces();

    expect(race).toEqual({
      grandPrixId: "gp1",
      seasonId: "2025",
      round: 1,
      name: "Australian Grand Prix",
      circuitName: "Albert Park Circuit",
      locality: "Melbourne",
      country: "Australia",
      date: "2025-03-16",
      hasSprint: false,
      hasResults: false,
    });
  });

  test("fetchRace honors an explicit has_results value regardless of sessions", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            grand_prix_id: "gp1",
            season_id: "2025",
            round: 1,
            race_name: "Australian Grand Prix",
            circuit_id: "albert_park",
            circuit_name: "Albert Park Circuit",
            locality: "Melbourne",
            country: "Australia",
            date: "2025-03-16",
            has_sprint: false,
            has_results: false,
            sessions: [
              {
                session_id: "gp1_race",
                type: "RACE",
                total_laps: 58,
                start_time: null,
                end_time: null,
              },
            ],
          },
        },
      })
    );

    const race = await fetchRace("gp1");

    expect(race.hasResults).toBe(false);
  });

  test("fetchRace derives hasResults from a RACE session when has_results is absent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            grand_prix_id: "gp1",
            season_id: "2025",
            round: 1,
            race_name: "Australian Grand Prix",
            circuit_id: "albert_park",
            circuit_name: "Albert Park Circuit",
            locality: "Melbourne",
            country: "Australia",
            date: "2025-03-16",
            has_sprint: false,
            sessions: [
              {
                session_id: "gp1_race",
                type: "RACE",
                total_laps: 58,
                start_time: null,
                end_time: null,
              },
            ],
          },
        },
      })
    );

    const race = await fetchRace("gp1");

    expect(race.hasResults).toBe(true);
  });

  test("fetchRace derives hasResults as false when no RACE session exists and has_results is absent", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: {
            grand_prix_id: "gp1",
            season_id: "2025",
            round: 1,
            race_name: "Australian Grand Prix",
            circuit_id: "albert_park",
            circuit_name: "Albert Park Circuit",
            locality: "Melbourne",
            country: "Australia",
            date: "2025-03-16",
            has_sprint: false,
            sessions: [
              {
                session_id: "gp1_quali",
                type: "QUALIFYING",
                total_laps: null,
                start_time: null,
                end_time: null,
              },
            ],
          },
        },
      })
    );

    const race = await fetchRace("gp1");

    expect(race.hasResults).toBe(false);
  });

  test("fetchDrivers maps an array of API drivers", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchResponse({
        ok: true,
        body: {
          data: [
            {
              driver_id: "lec",
              permanent_number: 16,
              given_name: "Charles",
              family_name: "Leclerc",
              nationality: "MON",
              date_of_birth: "1997-10-16",
              constructor_id: "FER",
              constructor_name: "Ferrari",
            },
          ],
        },
      })
    );

    const drivers = await fetchDrivers();

    expect(drivers).toEqual([
      {
        driverId: "lec",
        number: 16,
        name: "Charles Leclerc",
        team: "Ferrari",
        constructorId: "FER",
        nationality: "MON",
        dateOfBirth: "1997-10-16",
      },
    ]);
  });
});
