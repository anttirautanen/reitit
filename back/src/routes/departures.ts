import { eq } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Router } from "express"
import { ApiDeparture, ApiStopDepartures, ApiStopLineDepartures, DeparturesApiResponse } from "../api.js"
import { routeStopsTable, routesTable } from "../db/schema.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { STOP_DEPARTURES_QUERY } from "../digitransit/queries.js"
import { cacheKeyForRoute, getOrFetch } from "../realtime/cache.js"

/**
 * Realtime departures TTL. Short enough that consumers see fresh realtime
 * adjustments within ~half a minute; long enough to absorb bursty refresh
 * loops from the frontend without hammering Digitransit.
 */
const DEPARTURES_TTL_MS = 25 * 1000

/**
 * Timezone strategy: HSL departures are local Helsinki time. Digitransit
 * returns `serviceDay` as the Unix timestamp (seconds) of the service day's
 * local midnight, so adding `scheduledDeparture` / `realtimeDeparture`
 * (seconds since that midnight) yields an absolute epoch-second value that
 * we render as a UTC ISO-8601 string. When `serviceDay` is missing, we
 * derive today's Helsinki midnight via `Intl.DateTimeFormat` (Helsinki is
 * UTC+2 standard, UTC+3 DST — the formatter handles the offset for us).
 */

interface StopDeparturesRaw {
  gtfsId: string
  stoptimesWithoutPatterns:
    | {
        scheduledDeparture: number | null
        realtimeDeparture: number | null
        realtime: boolean | null
        serviceDay: number | null
        headsign: string | null
        trip: {
          route: {
            gtfsId: string
            shortName: string
          } | null
        } | null
      }[]
    | null
}

interface StopDeparturesQueryResponse {
  stops: (StopDeparturesRaw | null)[] | null
}

function parseRouteId(raw: string): number | null {
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function registerDeparturesRoutes(router: Router, deps: { db: NodePgDatabase; digitransitClient: DigitransitClient }): void {
  const { db, digitransitClient } = deps

  router.get("/routes/:routeId/departures", async (req, res) => {
    const routeId = parseRouteId(req.params.routeId)
    if (routeId === null) {
      res.status(400).send({ success: false, error: "Invalid route id" })
      return
    }

    const existingRoute = await db.select({ id: routesTable.id }).from(routesTable).where(eq(routesTable.id, routeId)).limit(1)
    if (existingRoute.length === 0) {
      res.status(404).send({ success: false, error: "Route not found" })
      return
    }

    const curatedRows = await db
      .select({ stopId: routeStopsTable.stopId, lines: routeStopsTable.lines })
      .from(routeStopsTable)
      .where(eq(routeStopsTable.routeId, routeId))

    if (curatedRows.length === 0) {
      const empty: DeparturesApiResponse = { stops: [] }
      res.send(empty)
      return
    }

    // Flatten to (stopId, lineGtfsId) pairs for the cache key.
    const stopLines: { stopId: string; lineGtfsId: string }[] = []
    for (const row of curatedRows) {
      for (const lineGtfsId of row.lines) {
        stopLines.push({ stopId: row.stopId, lineGtfsId })
      }
    }

    const key = cacheKeyForRoute({ routeId, kind: "departures", stopLines })

    // Distinct stop ids preserving order.
    const stopIds: string[] = []
    const stopIdSeen = new Set<string>()
    for (const row of curatedRows) {
      if (!stopIdSeen.has(row.stopId)) {
        stopIdSeen.add(row.stopId)
        stopIds.push(row.stopId)
      }
    }

    // Curated lines per stop, used to filter the upstream response.
    const curatedLinesByStop = new Map<string, Set<string>>()
    for (const row of curatedRows) {
      curatedLinesByStop.set(row.stopId, new Set(row.lines))
    }

    try {
      const response = await getOrFetch<DeparturesApiResponse>(key, DEPARTURES_TTL_MS, async () => {
        const data = await digitransitClient.query<StopDeparturesQueryResponse>(STOP_DEPARTURES_QUERY, { stopIds })
        return reshapeDepartures(data, curatedRows, curatedLinesByStop)
      })
      res.send(response)
    } catch (error) {
      if (error instanceof DigitransitUpstreamError) {
        console.error("Digitransit upstream error fetching departures:", error)
        res.status(502).send({ success: false, error: "Upstream Digitransit error" })
        return
      }
      throw error
    }
  })
}

function reshapeDepartures(
  data: StopDeparturesQueryResponse,
  curatedRows: { stopId: string; lines: string[] }[],
  curatedLinesByStop: Map<string, Set<string>>
): DeparturesApiResponse {
  // Index upstream stops by gtfsId for stable per-stop lookup.
  const upstreamByStopId = new Map<string, StopDeparturesRaw>()
  for (const stop of data.stops ?? []) {
    if (stop !== null) {
      upstreamByStopId.set(stop.gtfsId, stop)
    }
  }

  const stops: ApiStopDepartures[] = []
  for (const row of curatedRows) {
    const upstream = upstreamByStopId.get(row.stopId)
    const curatedLines = curatedLinesByStop.get(row.stopId) ?? new Set<string>()

    // Group departures by line gtfsId, preserving the order curated lines
    // appear in our DB row. Lines absent from the curated set are dropped.
    const departuresByLine = new Map<string, { shortName: string; departures: ApiDeparture[] }>()

    for (const stoptime of upstream?.stoptimesWithoutPatterns ?? []) {
      const route = stoptime.trip?.route
      if (route === null || route === undefined) continue
      if (!curatedLines.has(route.gtfsId)) continue

      const scheduledAt = secondsToIso(stoptime.serviceDay, stoptime.scheduledDeparture)
      const realtimeAt = secondsToIso(stoptime.serviceDay, stoptime.realtimeDeparture ?? stoptime.scheduledDeparture)
      if (scheduledAt === null || realtimeAt === null) continue

      const departure: ApiDeparture = {
        scheduledAt,
        realtimeAt,
        isRealtime: stoptime.realtime === true,
        headsign: stoptime.headsign ?? "",
      }

      const existing = departuresByLine.get(route.gtfsId)
      if (existing === undefined) {
        departuresByLine.set(route.gtfsId, {
          shortName: route.shortName,
          departures: [departure],
        })
      } else {
        existing.departures.push(departure)
      }
    }

    const lines: ApiStopLineDepartures[] = []
    for (const lineGtfsId of row.lines) {
      const entry = departuresByLine.get(lineGtfsId)
      if (entry === undefined) {
        // No upstream departures for this curated line; emit an empty bucket
        // so the frontend can still render the line row.
        lines.push({ gtfsId: lineGtfsId, shortName: "", departures: [] })
        continue
      }
      lines.push({ gtfsId: lineGtfsId, shortName: entry.shortName, departures: entry.departures })
    }

    stops.push({ stopId: row.stopId, lines })
  }

  return { stops }
}

function secondsToIso(serviceDay: number | null, secondsSinceMidnight: number | null): string | null {
  if (secondsSinceMidnight === null) return null
  const baseEpochSeconds = serviceDay ?? helsinkiTodayMidnightEpochSeconds()
  const epochMs = (baseEpochSeconds + secondsSinceMidnight) * 1000
  return new Date(epochMs).toISOString()
}

/**
 * Compute the Unix epoch seconds for "today's" Helsinki local midnight,
 * relative to the system clock. Used as a fallback when Digitransit omits
 * `serviceDay`. Uses `Intl.DateTimeFormat` to read the Helsinki Y/M/D, then
 * converts the resulting local midnight to epoch seconds via the offset
 * implied by the same formatter.
 */
function helsinkiTodayMidnightEpochSeconds(): number {
  const now = new Date()
  const helsinkiParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const parts: Record<string, string> = {}
  for (const p of helsinkiParts) {
    parts[p.type] = p.value
  }
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)

  // Construct a UTC timestamp for the same wall clock instant in Helsinki
  // (year-month-day 00:00:00). Then reverse-engineer the offset by comparing
  // to `now`'s wall clock representation.
  const helsinkiMidnightAsIfUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0)

  // To find Helsinki's offset at this instant, compute the difference between
  // the wall clock parts (interpreted as UTC) and the actual epoch value.
  const helsinkiNowAsIfUtcMs = Date.UTC(year, month - 1, day, Number(parts.hour) % 24, Number(parts.minute), Number(parts.second))
  const offsetMs = helsinkiNowAsIfUtcMs - now.getTime()

  return Math.floor((helsinkiMidnightAsIfUtcMs - offsetMs) / 1000)
}
