import { describe, expect, it } from "vitest";
import {
  CompositeRateLimiter,
  RateLimiter,
  retryAfterDelayMs,
} from "./rateLimiter.js";

/**
 * A controllable clock. Sleeping advances it, so a limiter's waits are
 * observable and instantaneous instead of real.
 */
function fakeClock() {
  let current = 1_000_000;
  const sleeps: number[] = [];

  return {
    now: () => current,
    sleep: async (ms: number): Promise<void> => {
      sleeps.push(ms);
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
    sleeps,
  };
}

describe("RateLimiter", () => {
  it("grants up to the limit without waiting", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      requestsPerInterval: 3,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(clock.sleeps).toEqual([]);
  });

  it("waits once the window is full", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      requestsPerInterval: 2,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    expect(clock.sleeps).toHaveLength(1);
    expect(clock.sleeps[0]).toBe(1000);
  });

  it("slides the window rather than resetting it", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      requestsPerInterval: 2,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await limiter.acquire();
    clock.advance(600);
    await limiter.acquire();

    // The first slot frees 400ms from now, not 1000ms.
    await limiter.acquire();

    expect(clock.sleeps[0]).toBe(400);
  });

  it("never exceeds the rate under concurrent callers", async () => {
    const clock = fakeClock();
    const start = clock.now();
    const limiter = new RateLimiter({
      requestsPerInterval: 2,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    // Six requests at 2 per second cannot complete in under two extra
    // seconds, however they interleave. Asserting on elapsed time rather
    // than on each caller's observed clock keeps this free of the microtask
    // ordering between a grant and the caller resuming.
    await Promise.all(
      Array.from({ length: 6 }, () => limiter.acquire())
    );

    expect(clock.now() - start).toBe(2000);
    expect(clock.sleeps).toEqual([1000, 1000]);
  });

  it("serialises grants so concurrent callers cannot claim the same slot", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      requestsPerInterval: 1,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await Promise.all(Array.from({ length: 4 }, () => limiter.acquire()));

    // One slot per second: three of the four had to wait a full interval.
    expect(clock.sleeps).toEqual([1000, 1000, 1000]);
  });

  it("keeps working after a caller rejects", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({
      requestsPerInterval: 5,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });

    await expect(
      limiter.acquire().then(() => {
        throw new Error("caller failed");
      })
    ).rejects.toThrow("caller failed");

    await expect(limiter.acquire()).resolves.toBeUndefined();
  });

  it("rejects a nonsensical rate", () => {
    expect(() => new RateLimiter({ requestsPerInterval: 0, intervalMs: 1000 })).toThrow();
  });
});

describe("CompositeRateLimiter", () => {
  it("makes a request satisfy every limiter", async () => {
    const clock = fakeClock();
    const burst = new RateLimiter({
      requestsPerInterval: 10,
      intervalMs: 1000,
      now: clock.now,
      sleep: clock.sleep,
    });
    const sustained = new RateLimiter({
      requestsPerInterval: 2,
      intervalMs: 100_000,
      now: clock.now,
      sleep: clock.sleep,
    });

    const composite = new CompositeRateLimiter([burst, sustained]);

    await composite.acquire();
    await composite.acquire();
    await composite.acquire();

    // The hourly-style budget binds before the burst one.
    expect(clock.sleeps).toEqual([100_000]);
  });
});

describe("retryAfterDelayMs", () => {
  it("reads a delay in seconds", () => {
    expect(retryAfterDelayMs("30")).toBe(30_000);
  });

  it("reads an HTTP date", () => {
    const now = Date.parse("2026-09-10T12:00:00Z");
    expect(
      retryAfterDelayMs("Thu, 10 Sep 2026 12:00:45 GMT", now)
    ).toBe(45_000);
  });

  it("clamps a date already in the past to zero", () => {
    const now = Date.parse("2026-09-10T12:00:00Z");
    expect(retryAfterDelayMs("Thu, 10 Sep 2026 11:59:00 GMT", now)).toBe(0);
  });

  it("returns null when absent or unparseable", () => {
    expect(retryAfterDelayMs(null)).toBeNull();
    expect(retryAfterDelayMs("")).toBeNull();
    expect(retryAfterDelayMs("soon")).toBeNull();
  });
});
