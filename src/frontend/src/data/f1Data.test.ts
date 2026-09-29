import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchConstructorStatistics } from "./f1Data";

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
