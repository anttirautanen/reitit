/**
 * Production `PatternResolver` factory for `resolveCuratedSet`.
 *
 * The resolver maps a `(stopId, lineGtfsId)` pair onto the set of directions
 * that line serves that stop. Pattern data is essentially static (it changes
 * only with timetable rolls), so the factory keeps a small LRU keyed on
 * `stopId` and reuses the same Digitransit answer for any line at that stop.
 *
 * The LRU lives inside the factory closure, so each `createPatternResolver`
 * call yields an independent cache — handler modules instantiate one per
 * register, and tests get a fresh cache per `startTestServer` run.
 */
import { LRUCache } from "lru-cache"
import { DigitransitClient } from "../digitransit/client.js"
import { STOP_PATTERNS_QUERY } from "../digitransit/queries.js"
import { LineDirectionTuple, PatternResolver } from "./curatedSet.js"

interface StopPatternsRaw {
  patterns:
    | {
        directionId: number | null
        route: {
          gtfsId: string
        } | null
      }[]
    | null
}

interface StopPatternsQueryResponse {
  stop: StopPatternsRaw | null
}

interface PatternsByLine {
  // Map from lineGtfsId -> set of directions, derived once per stopId fetch.
  byLine: Map<string, Set<0 | 1>>
}

const STOP_PATTERNS_TTL_MS = 60 * 60 * 1000 // 1 hour

export function createPatternResolver(client: DigitransitClient): PatternResolver {
  const stopCache = new LRUCache<string, PatternsByLine>({
    max: 1000,
    ttl: STOP_PATTERNS_TTL_MS,
  })

  async function loadStop(stopId: string): Promise<PatternsByLine> {
    const cached = stopCache.get(stopId)
    if (cached !== undefined) return cached

    const data = await client.query<StopPatternsQueryResponse>(STOP_PATTERNS_QUERY, { stopId })

    const byLine = new Map<string, Set<0 | 1>>()
    for (const pattern of data.stop?.patterns ?? []) {
      const lineGtfsId = pattern.route?.gtfsId
      const direction = pattern.directionId
      if (lineGtfsId === undefined || direction === null) continue
      if (direction !== 0 && direction !== 1) continue
      let set = byLine.get(lineGtfsId)
      if (set === undefined) {
        set = new Set<0 | 1>()
        byLine.set(lineGtfsId, set)
      }
      set.add(direction)
    }

    const value: PatternsByLine = { byLine }
    stopCache.set(stopId, value)
    return value
  }

  return async (stopId, lineGtfsId): Promise<LineDirectionTuple[] | null> => {
    const { byLine } = await loadStop(stopId)
    const directions = byLine.get(lineGtfsId)
    if (directions === undefined || directions.size === 0) return null
    const tuples: LineDirectionTuple[] = []
    for (const direction of directions) {
      tuples.push({ lineGtfsId, direction })
    }
    return tuples
  }
}
