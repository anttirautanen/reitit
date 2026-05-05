/**
 * Pure resolver that turns curated route rows into the data shapes the
 * realtime endpoints need.
 *
 * Given a list of `(routeId, stopId, lines[])` rows (one row per curated stop)
 * and an injected `PatternResolver`, this function produces:
 *   - `stopLines`: every `(stopId, lineGtfsId)` pair the rows imply, in input
 *     order. Used by the departures endpoint to fan out per-stop queries.
 *   - `lineDirections`: the deduplicated set of `(lineGtfsId, direction)`
 *     tuples those pairs are served by, sorted by `lineGtfsId` ascending then
 *     `direction` ascending. Used by the vehicles endpoint to filter the
 *     vehicle stream and to compose stable cache keys.
 *   - `unresolved`: pairs the resolver returned `null` for (unknown to the
 *     pattern catalog), in first-seen order.
 *
 * The function is pure: no I/O, no module-level mutable state. Memoisation of
 * resolver calls is per-invocation only.
 */

export interface CuratedRow {
  routeId: number
  stopId: string
  lines: string[]
}

export interface StopLinePair {
  stopId: string
  lineGtfsId: string
}

export interface LineDirectionTuple {
  lineGtfsId: string
  direction: 0 | 1
}

export type PatternResolver = (stopId: string, lineGtfsId: string) => Promise<LineDirectionTuple[] | null>

export interface ResolveResult {
  stopLines: StopLinePair[]
  lineDirections: LineDirectionTuple[]
  unresolved: StopLinePair[]
}

export async function resolveCuratedSet(rows: CuratedRow[], resolver: PatternResolver): Promise<ResolveResult> {
  // 1. Flatten rows into ordered (stopId, lineGtfsId) pairs.
  const stopLines: StopLinePair[] = []
  for (const row of rows) {
    for (const lineGtfsId of row.lines) {
      stopLines.push({ stopId: row.stopId, lineGtfsId })
    }
  }

  // 2. Collect the unique pairs (preserving first-seen order) and dispatch the
  //    resolver in parallel — once per unique pair.
  const uniquePairs: StopLinePair[] = []
  const seen = new Set<string>()
  for (const pair of stopLines) {
    const key = pairKey(pair.stopId, pair.lineGtfsId)
    if (seen.has(key)) continue
    seen.add(key)
    uniquePairs.push(pair)
  }

  const resolverResults = await Promise.all(uniquePairs.map((p) => resolver(p.stopId, p.lineGtfsId)))

  // 3. Walk the unique pairs in first-seen order so `unresolved` follows that
  //    order, and accumulate the deduplicated direction tuples.
  const unresolved: StopLinePair[] = []
  const directionsByKey = new Map<string, LineDirectionTuple>()
  for (let i = 0; i < uniquePairs.length; i++) {
    const pair = uniquePairs[i]
    const result = resolverResults[i]
    if (result === null) {
      unresolved.push(pair)
      continue
    }
    for (const tuple of result) {
      const key = directionKey(tuple.lineGtfsId, tuple.direction)
      if (!directionsByKey.has(key)) {
        directionsByKey.set(key, tuple)
      }
    }
  }

  // 4. Stable sort by lineGtfsId then direction so callers can compose stable
  //    cache keys.
  const lineDirections = Array.from(directionsByKey.values()).sort((a, b) => {
    if (a.lineGtfsId < b.lineGtfsId) return -1
    if (a.lineGtfsId > b.lineGtfsId) return 1
    return a.direction - b.direction
  })

  return { stopLines, lineDirections, unresolved }
}

function pairKey(stopId: string, lineGtfsId: string): string {
  return `${stopId}\u0000${lineGtfsId}`
}

function directionKey(lineGtfsId: string, direction: 0 | 1): string {
  return `${lineGtfsId}\u0000${String(direction)}`
}
