import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JolpicaClient, JolpicaError, backoffDelayMs } from "./jolpicaClient.js";
import type { FetchLike } from "./jolpicaClient.js";

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "jolpica-client-test-"));
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

interface PageSpec {
  limit: number;
  offset: number;
  total: number;
  rounds: number[];
}

function envelope(spec: PageSpec): unknown {
  return {
    MRData: {
      limit: String(spec.limit),
      offset: String(spec.offset),
      total: String(spec.total),
      RaceTable: {
        season: "2025",
        Races: spec.rounds.map((round) => ({
          season: "2025",
          round: String(round),
          raceName: `Round ${round}`,
          Circuit: {
            circuitId: `c${round}`,
            circuitName: `Circuit ${round}`,
            Location: { locality: "Town", country: "Country" },
          },
          date: "2025-03-16",
          Results: [],
        })),
      },
    },
  };
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(status: number, retryAfter?: string) {
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null,
    },
    json: async () => ({}),
    text: async () => "",
  };
}

/** Records every URL requested so pagination can be asserted precisely. */
function recordingFetch(responses: unknown[]): {
  fetchImpl: FetchLike;
  urls: string[];
} {
  const urls: string[] = [];
  let index = 0;

  const fetchImpl: FetchLike = async (url) => {
    urls.push(url);
    const body = responses[Math.min(index, responses.length - 1)];
    index += 1;

    return okResponse(body);
  };

  return { fetchImpl, urls };
}

function makeClient(fetchImpl: FetchLike, overrides = {}) {
  return new JolpicaClient({
    fetchImpl,
    cacheDir,
    sleep: async () => undefined,
    rateLimiter: { acquire: async () => undefined },
    ...overrides,
  });
}

describe("pagination", () => {
  it("fetches a single page when everything fits", async () => {
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 2, rounds: [1, 2] }),
    ]);

    const races = await makeClient(fetchImpl).fetchSeasonResults("2025");

    expect(races).toHaveLength(2);
    expect(urls).toEqual([
      "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=0",
    ]);
  });

  it("walks every page until total is reached", async () => {
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 250, rounds: [1] }),
      envelope({ limit: 100, offset: 100, total: 250, rounds: [2] }),
      envelope({ limit: 100, offset: 200, total: 250, rounds: [3] }),
    ]);

    const races = await makeClient(fetchImpl).fetchSeasonResults("2025");

    expect(races.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(urls).toEqual([
      "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=0",
      "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=100",
      "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=200",
    ]);
  });

  it("advances by the server's limit, not the requested one", async () => {
    // Jolpica silently caps limit at 100. A client that trusted its own
    // requested page size would skip rows.
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 25, offset: 0, total: 50, rounds: [1] }),
      envelope({ limit: 25, offset: 25, total: 50, rounds: [2] }),
    ]);

    await makeClient(fetchImpl).fetchSeasonResults("2025");

    expect(urls[1]).toContain("offset=25");
    expect(urls).toHaveLength(2);
  });

  it("stops on an empty page instead of looping forever", async () => {
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 9999, rounds: [] }),
    ]);

    const races = await makeClient(fetchImpl).fetchSeasonResults("2025");

    expect(races).toEqual([]);
    expect(urls).toHaveLength(1);
  });

  it("targets the sprint and calendar endpoints correctly", async () => {
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [2] }),
    ]);

    const client = makeClient(fetchImpl);
    await client.fetchSeasonSprintResults("2025");
    await client.fetchSeasonRaces("2024");

    expect(urls[0]).toContain("/2025/sprint/");
    expect(urls[1]).toContain("/2024/races/");
  });

  it("rejects a response that is not the Jolpica envelope", async () => {
    const { fetchImpl } = recordingFetch([{ nope: true }]);

    await expect(makeClient(fetchImpl).fetchSeasonResults("2025")).rejects.toThrow(
      JolpicaError
    );
  });
});

describe("caching", () => {
  it("serves a repeat request from disk without a second fetch", async () => {
    const { fetchImpl, urls } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }),
    ]);

    const client = makeClient(fetchImpl);
    await client.fetchSeasonResults("2025");
    await client.fetchSeasonResults("2025");

    expect(urls).toHaveLength(1);
  });

  it("shares the cache across client instances", async () => {
    const first = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }),
    ]);
    await makeClient(first.fetchImpl).fetchSeasonResults("2025");

    const second = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [99] }),
    ]);
    const races = await makeClient(second.fetchImpl).fetchSeasonResults("2025");

    expect(second.urls).toHaveLength(0);
    expect(races[0]?.round).toBe(1);
  });

  it("bypasses the cache under --refresh but repopulates it", async () => {
    const first = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }),
    ]);
    await makeClient(first.fetchImpl).fetchSeasonResults("2025");

    const second = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [99] }),
    ]);
    await makeClient(second.fetchImpl, { refresh: true }).fetchSeasonResults("2025");

    expect(second.urls).toHaveLength(1);

    // The refreshed body is now what a normal client sees.
    const third = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [123] }),
    ]);
    const races = await makeClient(third.fetchImpl).fetchSeasonResults("2025");

    expect(third.urls).toHaveLength(0);
    expect(races[0]?.round).toBe(99);
  });

  it("spends no rate-limit budget on a cache hit", async () => {
    const { fetchImpl } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }),
    ]);

    let acquisitions = 0;
    const rateLimiter = {
      acquire: async () => {
        acquisitions += 1;
      },
    };

    const client = makeClient(fetchImpl, { rateLimiter });
    await client.fetchSeasonResults("2025");
    await client.fetchSeasonResults("2025");

    expect(acquisitions).toBe(1);
  });
});

describe("rate limiting and retries", () => {
  it("acquires before every network request", async () => {
    const { fetchImpl } = recordingFetch([
      envelope({ limit: 100, offset: 0, total: 200, rounds: [1] }),
      envelope({ limit: 100, offset: 100, total: 200, rounds: [2] }),
    ]);

    const order: string[] = [];
    const rateLimiter = {
      acquire: async () => {
        order.push("acquire");
      },
    };

    const tracking: FetchLike = async (url, init) => {
      order.push("fetch");
      return fetchImpl(url, init);
    };

    await makeClient(tracking, { rateLimiter }).fetchSeasonResults("2025");

    expect(order).toEqual(["acquire", "fetch", "acquire", "fetch"]);
  });

  it("retries a 429 and honours Retry-After", async () => {
    const sleeps: number[] = [];
    let call = 0;

    const fetchImpl: FetchLike = async () => {
      call += 1;

      if (call === 1) {
        return errorResponse(429, "7");
      }

      return okResponse(envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }));
    };

    const races = await makeClient(fetchImpl, {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    }).fetchSeasonResults("2025");

    expect(races).toHaveLength(1);
    expect(sleeps).toEqual([7000]);
  });

  it("retries a 5xx with exponential backoff", async () => {
    const sleeps: number[] = [];
    let call = 0;

    const fetchImpl: FetchLike = async () => {
      call += 1;

      if (call <= 2) {
        return errorResponse(503);
      }

      return okResponse(envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }));
    };

    await makeClient(fetchImpl, {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    }).fetchSeasonResults("2025");

    expect(sleeps).toEqual([500, 1000]);
  });

  it("does not retry a 404", async () => {
    let calls = 0;

    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return errorResponse(404);
    };

    await expect(
      makeClient(fetchImpl).fetchSeasonResults("1066")
    ).rejects.toThrow(/404/);

    expect(calls).toBe(1);
  });

  it("retries a network-level failure", async () => {
    let calls = 0;

    const fetchImpl: FetchLike = async () => {
      calls += 1;

      if (calls === 1) {
        throw new Error("ECONNRESET");
      }

      return okResponse(envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }));
    };

    const races = await makeClient(fetchImpl).fetchSeasonResults("2025");

    expect(races).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("gives up after maxRetries and reports the last failure", async () => {
    const fetchImpl: FetchLike = async () => errorResponse(503);

    await expect(
      makeClient(fetchImpl, { maxRetries: 2 }).fetchSeasonResults("2025")
    ).rejects.toThrow(/after 3 attempts/);
  });

  it("does not cache a failed request", async () => {
    let calls = 0;

    const fetchImpl: FetchLike = async () => {
      calls += 1;

      if (calls === 1) {
        return errorResponse(500);
      }

      return okResponse(envelope({ limit: 100, offset: 0, total: 1, rounds: [1] }));
    };

    const client = makeClient(fetchImpl, { maxRetries: 0 });

    await expect(client.fetchSeasonResults("2025")).rejects.toThrow();
    await expect(client.fetchSeasonResults("2025")).resolves.toHaveLength(1);
  });
});

describe("backoffDelayMs", () => {
  it("doubles and then caps", () => {
    expect(backoffDelayMs(0)).toBe(500);
    expect(backoffDelayMs(1)).toBe(1000);
    expect(backoffDelayMs(2)).toBe(2000);
    expect(backoffDelayMs(20)).toBe(30_000);
  });
});
