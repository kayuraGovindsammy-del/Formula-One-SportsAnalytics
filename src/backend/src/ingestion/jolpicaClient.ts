// ---------------------------------------------------------------------------
// Jolpica-F1 HTTP client: pagination, on-disk caching, rate limiting.
//
// Everything the network does is behind this file. The mapping layer
// (transform.ts) is pure and sees only already-parsed Jolpica objects.
// ---------------------------------------------------------------------------

import { join } from "node:path";
import { tmpdir } from "node:os";
import { HttpCache } from "./httpCache.js";
import {
  CompositeRateLimiter,
  RateLimiter,
  defaultSleep,
  retryAfterDelayMs,
} from "./rateLimiter.js";
import {
  jolpicaEnvelopeSchema,
  type JolpicaEnvelope,
  type JolpicaRace,
} from "./jolpica.types.js";

export const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

/**
 * Jolpica silently caps `limit` at 100 -- asking for 200 returns 100 with
 * `MRData.limit: "100"`. Requesting the cap directly keeps the page loop
 * honest about how many round-trips a season costs.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Jolpica's published unauthenticated allowances: 4 requests/second burst and
 * 500/hour sustained. Both are enforced with headroom -- a 429 mid-ingest
 * costs far more than a few hundred milliseconds of politeness.
 */
export const DEFAULT_BURST_LIMIT = 3;
export const DEFAULT_BURST_INTERVAL_MS = 1_000;
export const DEFAULT_SUSTAINED_LIMIT = 450;
export const DEFAULT_SUSTAINED_INTERVAL_MS = 60 * 60 * 1_000;

/** Cache lifetime. A completed season is immutable; a live one is not. */
export const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface JolpicaClientOptions {
  baseUrl?: string;
  cacheDir?: string;
  cacheTtlMs?: number;
  /** Skip cache reads but still populate it. */
  refresh?: boolean;
  maxRetries?: number;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  rateLimiter?: { acquire(): Promise<void> };
  onProgress?: (message: string) => void;
}

export class JolpicaError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "JolpicaError";
  }
}

export function defaultCacheDir(): string {
  return join(tmpdir(), "f1-analytics-jolpica-cache");
}

export class JolpicaClient {
  private readonly baseUrl: string;
  private readonly cache: HttpCache;
  private readonly refresh: boolean;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly rateLimiter: { acquire(): Promise<void> };
  private readonly onProgress: (message: string) => void;

  constructor(options: JolpicaClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? JOLPICA_BASE_URL;
    this.refresh = options.refresh ?? false;
    this.maxRetries = options.maxRetries ?? 4;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.onProgress = options.onProgress ?? (() => undefined);

    this.cache = new HttpCache({
      directory: options.cacheDir ?? defaultCacheDir(),
      ttlMs: options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      ...(options.now ? { now: options.now } : {}),
    });

    const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);

    if (!fetchImpl) {
      throw new JolpicaError(
        "No fetch implementation available. Node 18+ or an injected fetchImpl is required."
      );
    }

    this.fetchImpl = fetchImpl;

    this.rateLimiter =
      options.rateLimiter ??
      new CompositeRateLimiter([
        new RateLimiter({
          requestsPerInterval: DEFAULT_BURST_LIMIT,
          intervalMs: DEFAULT_BURST_INTERVAL_MS,
          ...(options.now ? { now: options.now } : {}),
          ...(options.sleep ? { sleep: options.sleep } : {}),
        }),
        new RateLimiter({
          requestsPerInterval: DEFAULT_SUSTAINED_LIMIT,
          intervalMs: DEFAULT_SUSTAINED_INTERVAL_MS,
          ...(options.now ? { now: options.now } : {}),
          ...(options.sleep ? { sleep: options.sleep } : {}),
        }),
      ]);
  }

  private buildUrl(path: string, limit: number, offset: number): string {
    const trimmed = path.replace(/^\/+|\/+$/g, "");
    return `${this.baseUrl}/${trimmed}/?limit=${limit}&offset=${offset}`;
  }

  /**
   * One request: cache, then rate limiter, then network with retries.
   * A cache hit costs no rate-limit budget, which is the whole point.
   */
  private async fetchJson(url: string): Promise<unknown> {
    if (!this.refresh) {
      const cached = await this.cache.get(url);

      if (cached !== null) {
        this.onProgress(`cache hit  ${url}`);
        return cached;
      }
    }

    const body = await this.fetchWithRetries(url);
    await this.cache.set(url, body);

    return body;
  }

  private async fetchWithRetries(url: string): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      await this.rateLimiter.acquire();
      this.onProgress(`GET        ${url}`);

      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "f1-sport-analytics-ingest/1.0",
          },
        });

        if (response.ok) {
          return await response.json();
        }

        // 429 and 5xx are transient; 4xx otherwise means the request itself
        // is wrong and retrying just burns budget.
        if (response.status !== 429 && response.status < 500) {
          throw new JolpicaError(
            `Jolpica request failed: ${response.status} ${url}`,
            response.status
          );
        }

        lastError = new JolpicaError(
          `Jolpica request failed: ${response.status} ${url}`,
          response.status
        );

        const retryAfter = retryAfterDelayMs(
          response.headers.get("retry-after"),
          this.now()
        );

        if (attempt < this.maxRetries) {
          await this.sleep(retryAfter ?? backoffDelayMs(attempt));
        }
      } catch (error) {
        if (error instanceof JolpicaError && error.status !== undefined) {
          if (error.status !== 429 && error.status < 500) {
            throw error;
          }

          lastError = error;
          continue;
        }

        // Network-level failure (DNS, socket reset). Retriable.
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          await this.sleep(backoffDelayMs(attempt));
        }
      }
    }

    throw new JolpicaError(
      `Jolpica request failed after ${this.maxRetries + 1} attempts: ${url}` +
        (lastError ? ` (${lastError.message})` : "")
    );
  }

  /** Fetches and validates one page of a race-shaped endpoint. */
  async fetchPage(
    path: string,
    limit: number,
    offset: number
  ): Promise<JolpicaEnvelope["MRData"]> {
    const url = this.buildUrl(path, limit, offset);
    const parsed = jolpicaEnvelopeSchema.safeParse(await this.fetchJson(url));

    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `'${issue.path.join(".") || "MRData"}': ${issue.message}`)
        .join("; ");

      throw new JolpicaError(`Unexpected Jolpica response for ${url} — ${detail}`);
    }

    return parsed.data.MRData;
  }

  /**
   * Walks every page of a race-shaped endpoint and returns the flattened
   * races. Advances by the limit the SERVER reported, not the one requested,
   * so the silent cap at 100 cannot turn into an infinite loop or skipped rows.
   */
  async fetchAllRaces(path: string): Promise<JolpicaRace[]> {
    const races: JolpicaRace[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    let guard = 0;

    while (offset < total) {
      const data = await this.fetchPage(path, MAX_PAGE_SIZE, offset);

      total = data.total;
      races.push(...data.RaceTable.Races);

      const step = data.limit > 0 ? data.limit : MAX_PAGE_SIZE;
      offset += step;

      guard += 1;

      if (guard > 1_000) {
        throw new JolpicaError(
          `Pagination did not terminate for ${path} after ${guard} pages`
        );
      }

      // A page can legitimately return fewer races than results (many results
      // share one race), so `Races.length` is not a termination signal --
      // `total` is. But an empty page with more claimed means something is
      // wrong upstream; stop rather than spin.
      if (data.RaceTable.Races.length === 0) {
        break;
      }
    }

    return races;
  }

  /** Every race result for a season, across all pages. */
  async fetchSeasonResults(season: string): Promise<JolpicaRace[]> {
    return this.fetchAllRaces(`${season}/results`);
  }

  /**
   * Every pit stop for the supplied season rounds.
   *
   * Jolpica's Ergast-compatible pit-stop endpoint requires a round when a
   * season is supplied, e.g. `/2025/11/pitstops/`. A season-wide
   * `/2025/pitstops/` request returns HTTP 400.
   *
   * Fetching one round at a time also keeps each result set naturally small.
   * Requests are intentionally sequential so the existing shared rate limiter
   * controls the whole ingest.
   */
  async fetchSeasonPitStops(
    season: string,
    rounds: readonly number[]
  ): Promise<JolpicaRace[]> {
    const races: JolpicaRace[] = [];

    for (const round of rounds) {
      races.push(...(await this.fetchAllRaces(`${season}/${round}/pitstops`)));
    }

    return races;
  }

  /** Every sprint result for a season, across all pages. */
  async fetchSeasonSprintResults(season: string): Promise<JolpicaRace[]> {
    return this.fetchAllRaces(`${season}/sprint`);
  }

  /** The season calendar, which carries rounds with no results yet. */
  async fetchSeasonRaces(season: string): Promise<JolpicaRace[]> {
    return this.fetchAllRaces(`${season}/races`);
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

/** Exponential backoff with a ceiling: 0.5s, 1s, 2s, 4s, capped at 30s. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 30_000);
}
