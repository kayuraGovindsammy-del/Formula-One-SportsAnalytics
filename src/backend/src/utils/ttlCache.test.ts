import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttlCache.js";

function setup(ttlMs = 1000) {
  let clock = 0;
  const cache = createTtlCache<string>(ttlMs, () => clock);
  return { cache, advance: (ms: number) => (clock += ms) };
}

describe("createTtlCache", () => {
  it("loads once and serves the cached value until the TTL passes", async () => {
    const { cache, advance } = setup(1000);
    const load = vi.fn(async () => "season data");

    expect(await cache.get("2025", load)).toBe("season data");
    advance(999);
    expect(await cache.get("2025", load)).toBe("season data");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again once the entry has expired", async () => {
    const { cache, advance } = setup(1000);
    const load = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");

    expect(await cache.get("2025", load)).toBe("old");
    advance(1000);
    expect(await cache.get("2025", load)).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate entry per key", async () => {
    const { cache } = setup();
    const load = vi.fn(async () => "x");

    await cache.get("2025", load);
    await cache.get("2024", load);
    await cache.get("2025", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const { cache } = setup();
    let resolve: (value: string) => void = () => {};
    const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const first = cache.get("2025", load);
    const second = cache.get("2025", load);
    resolve("data");

    expect(await Promise.all([first, second])).toEqual(["data", "data"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed load", async () => {
    const { cache } = setup();
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("ok");

    await expect(cache.get("2025", load)).rejects.toThrow("db down");
    expect(await cache.get("2025", load)).toBe("ok");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("empties on clear", async () => {
    const { cache } = setup();
    const load = vi.fn(async () => "x");

    await cache.get("2025", load);
    cache.clear();
    await cache.get("2025", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
