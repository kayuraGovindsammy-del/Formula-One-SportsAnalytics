import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError.js";
import { createRateLimiter, type RateLimiterOptions } from "./rateLimit.js";

function setup(overrides: Partial<RateLimiterOptions> = {}) {
  let clock = Date.UTC(2026, 9, 5, 12, 0, 0);
  const limiter = createRateLimiter({
    perIpLimit: 3,
    windowMs: 60_000,
    dailyCap: 100,
    now: () => clock,
    ...overrides,
  });

  function hit(ip = "1.1.1.1") {
    const headers: Record<string, string> = {};
    const res = {
      set: vi.fn((name: string, value: string) => {
        headers[name] = value;
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    limiter({ ip } as Request, res, next);

    const forwarded: unknown = vi.mocked(next).mock.calls[0]?.[0];
    return {
      allowed: forwarded === undefined,
      error: forwarded instanceof ApiError ? forwarded : undefined,
      retryAfter: headers["Retry-After"],
    };
  }

  return {
    limiter,
    hit,
    advance: (ms: number) => {
      clock += ms;
    },
    setClock: (value: number) => {
      clock = value;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows up to the per-IP limit, then answers 429 RATE_LIMITED", () => {
    const { hit } = setup();

    expect([hit(), hit(), hit()].every((result) => result.allowed)).toBe(true);

    const blocked = hit();
    expect(blocked.allowed).toBe(false);
    expect(blocked.error).toMatchObject({ httpStatus: 429, code: "RATE_LIMITED" });
    expect(blocked.retryAfter).toBe("60");
  });

  it("counts each IP separately", () => {
    const { hit } = setup();

    hit("1.1.1.1");
    hit("1.1.1.1");
    hit("1.1.1.1");

    expect(hit("1.1.1.1").allowed).toBe(false);
    expect(hit("2.2.2.2").allowed).toBe(true);
  });

  it("opens a new window once the old one expires", () => {
    const { hit, advance } = setup();

    hit();
    hit();
    hit();
    advance(30_000);
    expect(hit().retryAfter).toBe("30");

    advance(30_000);
    expect(hit().allowed).toBe(true);
  });

  it("enforces the daily cap across all IPs", () => {
    const { hit } = setup({ perIpLimit: 100, dailyCap: 2 });

    expect(hit("1.1.1.1").allowed).toBe(true);
    expect(hit("2.2.2.2").allowed).toBe(true);

    const blocked = hit("3.3.3.3");
    expect(blocked.allowed).toBe(false);
    expect(blocked.error?.message).toMatch(/daily request limit/);
    // 12:00 UTC: twelve hours until the counter resets at midnight.
    expect(blocked.retryAfter).toBe(String(12 * 60 * 60));
  });

  it("resets the daily cap at UTC midnight", () => {
    const { hit, setClock } = setup({ perIpLimit: 100, dailyCap: 1 });

    setClock(Date.UTC(2026, 9, 5, 23, 59, 0));
    expect(hit("1.1.1.1").allowed).toBe(true);
    expect(hit("2.2.2.2").allowed).toBe(false);

    setClock(Date.UTC(2026, 9, 6, 0, 0, 1));
    expect(hit("3.3.3.3").allowed).toBe(true);
  });

  it("does not count rejected requests against the daily cap", () => {
    const { hit } = setup({ perIpLimit: 1, dailyCap: 2 });

    hit("1.1.1.1");
    hit("1.1.1.1"); // blocked per-IP
    hit("1.1.1.1"); // blocked per-IP

    expect(hit("2.2.2.2").allowed).toBe(true);
  });

  it("sweeps expired IP entries so memory stays bounded", () => {
    const { hit, advance } = setup({ sweepThreshold: 2 });

    hit("1.1.1.1");
    hit("2.2.2.2");
    advance(61_000);
    hit("3.3.3.3");

    // 1.1.1.1's old window was swept, so it starts fresh.
    expect([hit("1.1.1.1"), hit("1.1.1.1"), hit("1.1.1.1")].every((r) => r.allowed)).toBe(true);
  });

  it("clears every counter on reset", () => {
    const { limiter, hit } = setup({ perIpLimit: 1 });

    hit();
    expect(hit().allowed).toBe(false);

    limiter.reset();
    expect(hit().allowed).toBe(true);
  });
});
