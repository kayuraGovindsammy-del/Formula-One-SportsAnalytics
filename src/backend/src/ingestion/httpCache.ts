// ---------------------------------------------------------------------------
// On-disk response cache for the Jolpica-F1 client.
//
// A full-season ingest is ~5 requests for results and ~2 for sprints, but it
// gets re-run constantly while the mapping is being developed. Caching turns
// those iterations into zero network traffic, which is the difference between
// staying inside Jolpica's hourly budget and not.
//
// Entries are plain JSON on disk so they can be inspected, hand-edited or
// deleted individually while debugging a mapping.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CacheEntry {
  url: string;
  fetched_at: string;
  body: unknown;
}

export interface HttpCacheOptions {
  directory: string;
  /** Entries older than this are treated as absent. */
  ttlMs: number;
  now?: () => number;
}

/**
 * The URL is hashed for the filename but also stored inside the entry, so a
 * cache directory stays greppable and a hash collision cannot silently serve
 * one URL's body for another.
 */
function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export class HttpCache {
  private readonly directory: string;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: HttpCacheOptions) {
    this.directory = options.directory;
    this.ttlMs = options.ttlMs;
    this.now = options.now ?? Date.now;
  }

  private pathFor(url: string): string {
    return join(this.directory, `${cacheKey(url)}.json`);
  }

  /** Returns the cached body, or null on a miss, a stale entry or corruption. */
  async get(url: string): Promise<unknown | null> {
    let raw: string;

    try {
      raw = await readFile(this.pathFor(url), "utf8");
    } catch {
      return null;
    }

    let entry: CacheEntry;

    try {
      entry = JSON.parse(raw) as CacheEntry;
    } catch {
      // A truncated write from an interrupted run. Treat as a miss rather
      // than failing the ingest.
      return null;
    }

    if (entry.url !== url) {
      return null;
    }

    const fetchedAt = Date.parse(entry.fetched_at);

    if (Number.isNaN(fetchedAt) || this.now() - fetchedAt > this.ttlMs) {
      return null;
    }

    return entry.body;
  }

  async set(url: string, body: unknown): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    const entry: CacheEntry = {
      url,
      fetched_at: new Date(this.now()).toISOString(),
      body,
    };

    const target = this.pathFor(url);
    // Write-then-rename: an interrupted ingest leaves a stray temp file
    // rather than a half-written entry that parses as valid JSON.
    const temp = `${target}.${process.pid}.tmp`;

    await writeFile(temp, JSON.stringify(entry), "utf8");

    const { rename } = await import("node:fs/promises");
    await rename(temp, target);
  }

  async clear(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}
