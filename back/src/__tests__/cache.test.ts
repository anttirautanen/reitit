import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __resetCache, cacheKeyForRoute, getOrFetch } from "../realtime/cache.js"

describe("getOrFetch", () => {
  beforeEach(() => {
    __resetCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetCache()
  })

  it("calls the fetcher on a miss and skips it on a hit within TTL", async () => {
    const fetcher = vi.fn(() => Promise.resolve("value"))

    const first = await getOrFetch("key-1", 60_000, fetcher)
    const second = await getOrFetch("key-1", 60_000, fetcher)

    expect(first).toBe("value")
    expect(second).toBe("value")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("re-fetches once the TTL has expired", async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(() => Promise.resolve("value"))

    await getOrFetch("key-2", 1_000, fetcher)
    vi.advanceTimersByTime(1_500)
    await getOrFetch("key-2", 1_000, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("does not collide across distinct keys", async () => {
    const fetcher = vi.fn((): Promise<string> => Promise.resolve("v"))

    await getOrFetch("key-a", 60_000, fetcher)
    await getOrFetch("key-b", 60_000, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe("cacheKeyForRoute", () => {
  beforeEach(() => {
    __resetCache()
  })

  it("produces the same key regardless of stopLines ordering", () => {
    const a = cacheKeyForRoute({
      routeId: 1,
      kind: "departures",
      stopLines: [
        { stopId: "HSL:1", lineGtfsId: "HSL:A" },
        { stopId: "HSL:2", lineGtfsId: "HSL:B" },
      ],
    })
    const b = cacheKeyForRoute({
      routeId: 1,
      kind: "departures",
      stopLines: [
        { stopId: "HSL:2", lineGtfsId: "HSL:B" },
        { stopId: "HSL:1", lineGtfsId: "HSL:A" },
      ],
    })

    expect(a).toBe(b)
  })

  it("produces the same key regardless of lineDirections ordering", () => {
    const a = cacheKeyForRoute({
      routeId: 1,
      kind: "vehicles",
      lineDirections: [
        { lineGtfsId: "HSL:A", direction: 0 },
        { lineGtfsId: "HSL:B", direction: 1 },
      ],
    })
    const b = cacheKeyForRoute({
      routeId: 1,
      kind: "vehicles",
      lineDirections: [
        { lineGtfsId: "HSL:B", direction: 1 },
        { lineGtfsId: "HSL:A", direction: 0 },
      ],
    })

    expect(a).toBe(b)
  })

  it("produces different keys for the same set across different kinds", () => {
    const stopLines = [{ stopId: "HSL:1", lineGtfsId: "HSL:A" }]

    const departures = cacheKeyForRoute({ routeId: 1, kind: "departures", stopLines })
    const vehicles = cacheKeyForRoute({ routeId: 1, kind: "vehicles", stopLines })

    expect(departures).not.toBe(vehicles)
  })

  it("produces different keys for the same set across different routeIds", () => {
    const stopLines = [{ stopId: "HSL:1", lineGtfsId: "HSL:A" }]

    const route1 = cacheKeyForRoute({ routeId: 1, kind: "departures", stopLines })
    const route2 = cacheKeyForRoute({ routeId: 2, kind: "departures", stopLines })

    expect(route1).not.toBe(route2)
  })

  it("produces different keys when stopLines content differs for the same (routeId, kind)", () => {
    const a = cacheKeyForRoute({
      routeId: 1,
      kind: "departures",
      stopLines: [{ stopId: "A", lineGtfsId: "1" }],
    })
    const b = cacheKeyForRoute({
      routeId: 1,
      kind: "departures",
      stopLines: [{ stopId: "A", lineGtfsId: "2" }],
    })

    expect(a).not.toBe(b)
  })

  it("produces the same key when both stopLines and lineDirections are undefined", () => {
    const a = cacheKeyForRoute({ routeId: 1, kind: "departures" })
    const b = cacheKeyForRoute({ routeId: 1, kind: "departures" })

    expect(a).toBe(b)
  })
})
