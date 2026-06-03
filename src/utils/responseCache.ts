type CacheEntry = { expiresAt: number; payload: unknown };

const store = new Map<string, CacheEntry>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.payload as T;
}

export function cacheSet(key: string, payload: unknown, ttlMs: number): void {
  store.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheInvalidate(keys: string[]): void {
  for (const key of keys) cacheInvalidatePrefix(key);
}

/** Clear public list caches after CMS publish/update */
export function invalidatePublicContentCaches(): void {
  cacheInvalidate(["site:writing", "books:feed", "articles:feed", "site:payload"]);
}
