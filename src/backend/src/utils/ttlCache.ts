/**
 * A small in-memory cache of async results with a time-to-live, per key.
 *
 * Concurrent requests for the same key share one load. A load that fails is
 * not cached, so the next request tries again. State is per process.
 */
export interface TtlCache<T> {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createTtlCache<T>(
  ttlMs: number,
  now: () => number = () => Date.now()
): TtlCache<T> {
  const entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

  return {
    get(key, load) {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now()) {
        return cached.value;
      }

      const value = load();
      entries.set(key, { value, expiresAt: now() + ttlMs });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    },

    clear() {
      entries.clear();
    },
  };
}
