import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpCache } from "./httpCache.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "jolpica-cache-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const URL_A = "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=0";
const URL_B = "https://api.jolpi.ca/ergast/f1/2025/results/?limit=100&offset=100";

describe("HttpCache", () => {
  it("misses on an empty cache", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    expect(await cache.get(URL_A)).toBeNull();
  });

  it("round-trips a body", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { MRData: { total: "479" } });

    expect(await cache.get(URL_A)).toEqual({ MRData: { total: "479" } });
  });

  it("keys separately per URL", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { page: 1 });
    await cache.set(URL_B, { page: 2 });

    expect(await cache.get(URL_A)).toEqual({ page: 1 });
    expect(await cache.get(URL_B)).toEqual({ page: 2 });
  });

  it("expires an entry past its TTL", async () => {
    let now = 1_000_000;
    const cache = new HttpCache({ directory, ttlMs: 1000, now: () => now });

    await cache.set(URL_A, { fresh: true });
    now += 1001;

    expect(await cache.get(URL_A)).toBeNull();
  });

  it("serves an entry within its TTL", async () => {
    let now = 1_000_000;
    const cache = new HttpCache({ directory, ttlMs: 1000, now: () => now });

    await cache.set(URL_A, { fresh: true });
    now += 999;

    expect(await cache.get(URL_A)).toEqual({ fresh: true });
  });

  it("treats a corrupt entry as a miss rather than throwing", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { ok: true });

    const files = await readdir(directory);
    const first = files[0];

    expect(first).toBeDefined();
    await writeFile(join(directory, String(first)), "{not json", "utf8");

    expect(await cache.get(URL_A)).toBeNull();
  });

  it("does not serve one URL's body for another", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { page: 1 });

    const files = await readdir(directory);
    const first = files[0];

    expect(first).toBeDefined();
    // Same file, but the recorded URL no longer matches the request.
    await writeFile(
      join(directory, String(first)),
      JSON.stringify({
        url: "https://example.invalid/other",
        fetched_at: new Date().toISOString(),
        body: { page: 999 },
      }),
      "utf8"
    );

    expect(await cache.get(URL_A)).toBeNull();
  });

  it("leaves no temp files behind after a write", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { ok: true });

    const files = await readdir(directory);

    expect(files.filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("creates its directory on demand", async () => {
    const nested = join(directory, "deep", "nested");
    const cache = new HttpCache({ directory: nested, ttlMs: 1000 });

    await cache.set(URL_A, { ok: true });

    expect(await cache.get(URL_A)).toEqual({ ok: true });
  });

  it("clears everything", async () => {
    const cache = new HttpCache({ directory, ttlMs: 1000 });
    await cache.set(URL_A, { ok: true });
    await cache.clear();

    expect(await cache.get(URL_A)).toBeNull();
  });
});
