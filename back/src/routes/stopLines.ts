import { Router } from "express"
import { LRUCache } from "lru-cache"
import { ApiStopLine, StopLinesApiResponse } from "../api.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { STOP_LINES_QUERY } from "../digitransit/queries.js"

interface StopLineRoute {
  gtfsId: string
  shortName: string
  mode: string
}

interface StopLinesQueryResponse {
  stop: {
    routes: StopLineRoute[] | null
  } | null
}

// Natural-sort collator: orders shortName values like "2", "10", "94K", "550"
// in numeric ascending order rather than lexicographically.
const shortNameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function registerStopLinesRoutes(router: Router, deps: { digitransitClient: DigitransitClient }): void {
  const { digitransitClient } = deps

  // Module-internal cache scoped per stopId. TTL is 1 hour: line membership at
  // a stop changes rarely, and the picker UI is not latency sensitive enough
  // to need fresher data than this.
  const cache = new LRUCache<string, StopLinesApiResponse>({
    max: 1000,
    ttl: 60 * 60 * 1000, // 1 hour
  })

  router.get("/stops/:stopId/lines", async (req, res) => {
    const stopId = decodeURIComponent(req.params.stopId).trim()
    if (stopId.length === 0) {
      res.status(400).send({ success: false, error: "Invalid stop id" })
      return
    }

    const cached = cache.get(stopId)
    if (cached !== undefined) {
      res.send(cached)
      return
    }

    let data: StopLinesQueryResponse
    try {
      data = await digitransitClient.query<StopLinesQueryResponse>(STOP_LINES_QUERY, { stopId })
    } catch (error) {
      if (error instanceof DigitransitUpstreamError) {
        console.error("Digitransit upstream error fetching stop lines:", error)
        res.status(502).send({ success: false, error: "Upstream Digitransit error" })
        return
      }
      throw error
    }

    const routes = data.stop?.routes ?? []
    const lines: ApiStopLine[] = routes
      .map((r) => ({ gtfsId: r.gtfsId, shortName: r.shortName, mode: r.mode }))
      .sort((a, b) => {
        const cmp = shortNameCollator.compare(a.shortName, b.shortName)
        if (cmp !== 0) return cmp
        if (a.gtfsId < b.gtfsId) return -1
        if (a.gtfsId > b.gtfsId) return 1
        return 0
      })

    const response: StopLinesApiResponse = { lines }
    cache.set(stopId, response)
    res.send(response)
  })
}
