// ---------------------------------------------------------------------------
// Client-side rate limiting for the Jolpica-F1 API.
//
// Jolpica publishes a burst allowance per second and a sustained allowance per
// hour for unauthenticated callers. Exceeding either returns 429. This limiter
// enforces both locally so a full-season ingest never has to rely on the
// server telling it to slow down -- and `retryAfterDelayMs` handles the case
// where it does anyway.
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum requests permitted in any rolling `intervalMs` window. */
  requestsPerInterval: number;
  intervalMs: number;
  /** Injected so tests can drive time without waiting. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * A rolling-window limiter. It records the timestamp of each granted request
 * and, once the window is full, waits exactly until the oldest one falls out
 * of it. A sliding window rather than a fixed one, so a burst at the end of
 * one window plus a burst at the start of the next cannot exceed the rate.
 */
export class RateLimiter {
  private readonly requestsPerInterval: number;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly grantedAt: number[] = [];

  /** Serialises acquire() so concurrent callers cannot both see a free slot. */
  private queue: Promise<void> = Promise.resolve();

  constructor(options: RateLimiterOptions) {
    if (options.requestsPerInterval < 1) {
      throw new Error("requestsPerInterval must be at least 1");
    }

    this.requestsPerInterval = options.requestsPerInterval;
    this.intervalMs = options.intervalMs;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Resolves once the caller is clear to issue a request. */
  async acquire(): Promise<void> {
    const turn = this.queue.then(() => this.reserve());

    // Swallow on the chained copy only: the caller still sees a rejection,
    // but one failure must not poison every subsequent acquire().
    this.queue = turn.catch(() => undefined);

    return turn;
  }

  private async reserve(): Promise<void> {
    for (;;) {
      this.evictExpired();

      if (this.grantedAt.length < this.requestsPerInterval) {
        this.grantedAt.push(this.now());
        return;
      }

      const oldest = this.grantedAt[0];

      if (oldest === undefined) {
        continue;
      }

      const waitMs = oldest + this.intervalMs - this.now();

      // Re-check rather than granting straight after the sleep: a mocked or
      // coarse clock can leave the slot still occupied.
      await this.sleep(Math.max(waitMs, 1));
    }
  }

  private evictExpired(): void {
    const cutoff = this.now() - this.intervalMs;

    while (this.grantedAt.length > 0) {
      const oldest = this.grantedAt[0];

      if (oldest === undefined || oldest > cutoff) {
        break;
      }

      this.grantedAt.shift();
    }
  }
}

/**
 * Runs `limiters` in series. Jolpica enforces a per-second AND a per-hour
 * budget, so a request must satisfy every limiter before it goes out.
 */
export class CompositeRateLimiter {
  constructor(private readonly limiters: readonly RateLimiter[]) {}

  async acquire(): Promise<void> {
    for (const limiter of this.limiters) {
      await limiter.acquire();
    }
  }
}

/**
 * Honours a 429's Retry-After, which may be either a delay in seconds or an
 * HTTP date. Returns null when the header is absent or unparseable, leaving
 * the caller on its own backoff schedule.
 */
export function retryAfterDelayMs(
  header: string | null,
  now: number = Date.now()
): number | null {
  if (header === null) {
    return null;
  }

  const trimmed = header.trim();

  if (trimmed === "") {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const asDate = Date.parse(trimmed);

  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(asDate - now, 0);
}
