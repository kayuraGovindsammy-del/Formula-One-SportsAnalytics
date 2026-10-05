// ---------------------------------------------------------------------------
// A small in-memory rate limiter, hand-written to avoid a dependency.
//
// Two limits, both checked before the handler runs:
//   - per client IP: at most `perIpLimit` requests per fixed `windowMs` window
//   - global: at most `dailyCap` requests per UTC day, across every client,
//     to keep a free upstream quota from being exhausted
//
// State lives in this process only: it resets on restart and is not shared
// between instances, which is enough for a single Railway instance.
//
// The client is identified by `req.ip`. Behind a reverse proxy that is the
// proxy's address unless Express's "trust proxy" setting is configured — see
// app.ts.
// ---------------------------------------------------------------------------

import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./ApiError.js";

export interface RateLimiterOptions {
  perIpLimit: number;
  windowMs: number;
  dailyCap: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Expired IP entries are swept once this many are tracked. */
  sweepThreshold?: number;
}

export interface RateLimiter extends RequestHandler {
  /** The configured limits, so callers and tests can check the wiring. */
  readonly limits: { perIpLimit: number; windowMs: number; dailyCap: number };
  /** Clears all counters. For tests. */
  reset(): void;
}

interface WindowCount {
  windowStart: number;
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS);
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const now = options.now ?? Date.now;
  const sweepThreshold = options.sweepThreshold ?? 10_000;

  const perIp = new Map<string, WindowCount>();
  let daily = { day: utcDay(now()), count: 0 };

  function sweep(at: number): void {
    for (const [ip, entry] of perIp) {
      if (at - entry.windowStart >= options.windowMs) perIp.delete(ip);
    }
  }

  const limiter = (req: Request, res: Response, next: NextFunction): void => {
    const at = now();

    const today = utcDay(at);
    if (daily.day !== today) {
      daily = { day: today, count: 0 };
    }

    if (perIp.size >= sweepThreshold) {
      sweep(at);
    }

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    let entry = perIp.get(ip);
    if (!entry || at - entry.windowStart >= options.windowMs) {
      entry = { windowStart: at, count: 0 };
      perIp.set(ip, entry);
    }

    if (entry.count >= options.perIpLimit) {
      const retryAfterMs = entry.windowStart + options.windowMs - at;
      res.set("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      next(ApiError.rateLimited("Too many requests. Please wait a minute and try again."));
      return;
    }

    if (daily.count >= options.dailyCap) {
      const retryAfterMs = (today + 1) * DAY_MS - at;
      res.set("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      next(
        ApiError.rateLimited(
          "The daily request limit has been reached. Please try again tomorrow."
        )
      );
      return;
    }

    entry.count += 1;
    daily.count += 1;
    next();
  };

  return Object.assign(limiter, {
    limits: {
      perIpLimit: options.perIpLimit,
      windowMs: options.windowMs,
      dailyCap: options.dailyCap,
    },
    reset(): void {
      perIp.clear();
      daily = { day: utcDay(now()), count: 0 };
    },
  });
}
