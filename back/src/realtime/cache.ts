/**
 * In-memory realtime cache facade shared by the upcoming departures and
 * vehicles handlers. A thin wrapper over a single module-level `lru-cache`
 * instance with two responsibilities:
 *   - `cacheKeyForRoute`: build a deterministic, order-independent key from a
 *     `(routeId, kind, set)` triple so equivalent curated sets collide on the
 *     same cache entry regardless of input ordering.
 *   - `getOrFetch`: serve cached values within their TTL or call the supplied
 *     fetcher and cache its result.
 *
 * Future swap-out for Redis is straightforward because callers only see these
 * two functions; the LRU instance is private.
 */
import { createHash } from "node:crypto"
import { LRUCache } from "lru-cache"

export type CacheKind = "departures" | "vehicles"

export interface CacheKeyInput {
  routeId: number
  kind: CacheKind
  stopLines?: { stopId: string; lineGtfsId: string }[]
  lineDirections?: { lineGtfsId: string; direction: 0 | 1 }[]
}

// `\u0000` cannot appear in GTFS ids, so it is safe to use as a field
// separator inside the pre-hash representation.
const SEP = "\u0000"

// `lru-cache` only enables its TTL machinery when constructed with a non-zero
// `ttl`, so we set a large default and let `getOrFetch` override it per-entry.
const DEFAULT_TTL_MS = 60 * 60 * 1000

// `LRUCache<K, V>` requires `V extends {}` (i.e. non-nullish). We narrow to
// `NonNullable<unknown>` so any defined value is acceptable.
const cache = new LRUCache<string, NonNullable<unknown>>({
  max: 1000,
  ttl: DEFAULT_TTL_MS,
  // Use `Date.now()` rather than `performance.now()` so test fake timers
  // (which mock `Date` reliably) advance the cache's notion of time.
  perf: { now: () => Date.now() },
  // Disable internal `cachedNow` debouncing so every freshness check reads
  // the current time directly — important under fake timers.
  ttlResolution: 0,
})

/**
 * Build a deterministic cache key for a `(routeId, kind, set)` triple.
 *
 * Order-independence: `stopLines` are sorted by `(stopId, lineGtfsId)` and
 * `lineDirections` by `(lineGtfsId, direction)` before hashing, so two
 * permutations of the same set produce the same key. The returned string is
 * `kind:routeId:` followed by a SHA-256 hex digest, which keeps key length
 * bounded (64 hex chars + prefix) regardless of input size.
 */
export function cacheKeyForRoute(input: CacheKeyInput): string {
  const parts: string[] = []

  if (input.stopLines && input.stopLines.length > 0) {
    const sorted = [...input.stopLines].sort((a, b) => {
      if (a.stopId < b.stopId) return -1
      if (a.stopId > b.stopId) return 1
      if (a.lineGtfsId < b.lineGtfsId) return -1
      if (a.lineGtfsId > b.lineGtfsId) return 1
      return 0
    })
    parts.push("sl")
    for (const pair of sorted) {
      parts.push(pair.stopId, pair.lineGtfsId)
    }
  }

  if (input.lineDirections && input.lineDirections.length > 0) {
    const sorted = [...input.lineDirections].sort((a, b) => {
      if (a.lineGtfsId < b.lineGtfsId) return -1
      if (a.lineGtfsId > b.lineGtfsId) return 1
      return a.direction - b.direction
    })
    parts.push("ld")
    for (const tuple of sorted) {
      parts.push(tuple.lineGtfsId, String(tuple.direction))
    }
  }

  const payload = [input.kind, String(input.routeId), ...parts].join(SEP)
  const digest = createHash("sha256").update(payload).digest("hex")
  return `${input.kind}:${String(input.routeId)}:${digest}`
}

/**
 * Return the cached value for `key` if present and within TTL; otherwise
 * invoke `fetcher`, cache its resolved value with the given TTL, and return
 * it.
 *
 * Concurrent misses for the same key may both invoke the fetcher (no
 * single-flight de-duplication); the upstream is rate-limited at our layer
 * and the brief duplication is acceptable at our scale.
 */
export async function getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as T | undefined
  if (hit !== undefined) {
    return hit
  }
  const value = await fetcher()
  cache.set(key, value as NonNullable<unknown>, { ttl: ttlMs })
  return value
}

/**
 * Test-only: clear the shared LRU between cases. Do not import from
 * production code — the leading double underscore signals this.
 */
export function __resetCache(): void {
  cache.clear()
}
