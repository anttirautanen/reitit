import { describe, expect, it, vi } from "vitest"
import { resolveCuratedSet, type CuratedRow, type LineDirectionTuple, type PatternResolver } from "../realtime/curatedSet.js"

describe("resolveCuratedSet", () => {
  it("returns empty results without invoking the resolver when given no rows", async () => {
    const resolver = vi.fn<PatternResolver>(() => Promise.resolve([]))

    const result = await resolveCuratedSet([], resolver)

    expect(result).toEqual({ stopLines: [], lineDirections: [], unresolved: [] })
    expect(resolver).not.toHaveBeenCalled()
  })

  it("resolves a single row with a single line and a single direction", async () => {
    const rows: CuratedRow[] = [{ routeId: 1, stopId: "HSL:1", lines: ["HSL:A"] }]
    const resolver: PatternResolver = (_stopId, lineGtfsId) => Promise.resolve([{ lineGtfsId, direction: 0 }])

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.stopLines).toEqual([{ stopId: "HSL:1", lineGtfsId: "HSL:A" }])
    expect(result.lineDirections).toEqual([{ lineGtfsId: "HSL:A", direction: 0 }])
    expect(result.unresolved).toEqual([])
  })

  it("collapses the same direction tuple seen at multiple stops into a single entry", async () => {
    const rows: CuratedRow[] = [
      { routeId: 1, stopId: "HSL:1", lines: ["HSL:A"] },
      { routeId: 1, stopId: "HSL:2", lines: ["HSL:A"] },
    ]
    const resolver: PatternResolver = (_stopId, lineGtfsId) => Promise.resolve([{ lineGtfsId, direction: 0 }])

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.stopLines).toHaveLength(2)
    expect(result.lineDirections).toEqual([{ lineGtfsId: "HSL:A", direction: 0 }])
  })

  it("keeps both directions when the same line is served in opposite directions across stops", async () => {
    const rows: CuratedRow[] = [
      { routeId: 1, stopId: "HSL:1", lines: ["HSL:A"] },
      { routeId: 1, stopId: "HSL:2", lines: ["HSL:A"] },
    ]
    const resolver: PatternResolver = (stopId, lineGtfsId) => {
      const direction: 0 | 1 = stopId === "HSL:1" ? 0 : 1
      return Promise.resolve([{ lineGtfsId, direction }])
    }

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.lineDirections).toEqual([
      { lineGtfsId: "HSL:A", direction: 0 },
      { lineGtfsId: "HSL:A", direction: 1 },
    ])
  })

  it("expands a multi-line row into one (stop, line) pair per line", async () => {
    const rows: CuratedRow[] = [{ routeId: 1, stopId: "HSL:1", lines: ["HSL:A", "HSL:B", "HSL:C"] }]
    const resolver = vi.fn<PatternResolver>((_stopId, lineGtfsId) => Promise.resolve<LineDirectionTuple[]>([{ lineGtfsId, direction: 0 }]))

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.stopLines).toEqual([
      { stopId: "HSL:1", lineGtfsId: "HSL:A" },
      { stopId: "HSL:1", lineGtfsId: "HSL:B" },
      { stopId: "HSL:1", lineGtfsId: "HSL:C" },
    ])
    expect(resolver).toHaveBeenCalledTimes(3)
    expect(result.lineDirections).toHaveLength(3)
  })

  it("records pairs the resolver returns null for and excludes them from lineDirections", async () => {
    const rows: CuratedRow[] = [
      { routeId: 1, stopId: "HSL:1", lines: ["HSL:A"] },
      { routeId: 1, stopId: "HSL:2", lines: ["HSL:B"] },
    ]
    const resolver: PatternResolver = (stopId, lineGtfsId) => {
      if (stopId === "HSL:2") return Promise.resolve(null)
      return Promise.resolve([{ lineGtfsId, direction: 0 }])
    }

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.unresolved).toEqual([{ stopId: "HSL:2", lineGtfsId: "HSL:B" }])
    expect(result.lineDirections).toEqual([{ lineGtfsId: "HSL:A", direction: 0 }])
    expect(result.stopLines).toEqual([
      { stopId: "HSL:1", lineGtfsId: "HSL:A" },
      { stopId: "HSL:2", lineGtfsId: "HSL:B" },
    ])
  })

  it("returns lineDirections sorted by lineGtfsId ascending then direction ascending", async () => {
    const rows: CuratedRow[] = [
      { routeId: 1, stopId: "HSL:1", lines: ["HSL:Z"] },
      { routeId: 1, stopId: "HSL:2", lines: ["HSL:A"] },
      { routeId: 1, stopId: "HSL:3", lines: ["HSL:M"] },
    ]
    const resolver: PatternResolver = (_stopId, lineGtfsId) =>
      Promise.resolve<LineDirectionTuple[]>([
        { lineGtfsId, direction: 1 },
        { lineGtfsId, direction: 0 },
      ])

    const result = await resolveCuratedSet(rows, resolver)

    expect(result.lineDirections).toEqual([
      { lineGtfsId: "HSL:A", direction: 0 },
      { lineGtfsId: "HSL:A", direction: 1 },
      { lineGtfsId: "HSL:M", direction: 0 },
      { lineGtfsId: "HSL:M", direction: 1 },
      { lineGtfsId: "HSL:Z", direction: 0 },
      { lineGtfsId: "HSL:Z", direction: 1 },
    ])
  })

  it("invokes the resolver at most once per unique (stopId, lineGtfsId) pair within a single call", async () => {
    const rows: CuratedRow[] = [
      { routeId: 1, stopId: "HSL:1234", lines: ["HSL:A"] },
      { routeId: 2, stopId: "HSL:1234", lines: ["HSL:A"] },
    ]
    const resolver = vi.fn<PatternResolver>((_stopId, lineGtfsId) => Promise.resolve<LineDirectionTuple[]>([{ lineGtfsId, direction: 0 }]))

    const result = await resolveCuratedSet(rows, resolver)

    expect(resolver).toHaveBeenCalledTimes(1)
    expect(resolver).toHaveBeenCalledWith("HSL:1234", "HSL:A")
    expect(result.stopLines).toEqual([
      { stopId: "HSL:1234", lineGtfsId: "HSL:A" },
      { stopId: "HSL:1234", lineGtfsId: "HSL:A" },
    ])
    expect(result.lineDirections).toEqual([{ lineGtfsId: "HSL:A", direction: 0 }])
  })
})
