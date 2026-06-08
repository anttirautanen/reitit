import { eq } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Router } from "express"
import { ApiVehicle, VehiclesApiResponse } from "../api.js"
import { routeStopsTable, routesTable } from "../db/schema.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { VEHICLE_POSITIONS_QUERY } from "../digitransit/queries.js"
import { cacheKeyForRoute, getOrFetch } from "../realtime/cache.js"
import { CuratedRow, CuratedStopsForLineDirection, LineDirectionTuple, resolveCuratedSet } from "../realtime/curatedSet.js"
import { keepVehiclePastCuratedStops } from "../realtime/passedStopFilter.js"
import { createPatternResolver } from "../realtime/patternResolver.js"
import { parseRouteId } from "./parseRouteId.js"

/**
 * Realtime vehicles TTL. Short enough that the map view stays close to live
 * (~3s lag), long enough that bursty client polling does not amplify into the
 * upstream.
 */
const VEHICLES_TTL_MS = 3 * 1000

interface TripStoptimeRaw {
  stopPosition: number | null
  stop: {
    gtfsId: string
  } | null
}

interface VehiclePositionRaw {
  vehicleId: string | null
  stopRelationship: {
    status: string | null
    stop: {
      gtfsId: string
    } | null
  } | null
  trip: {
    route: {
      gtfsId: string
      shortName: string | null
    } | null
    stoptimes: TripStoptimeRaw[] | null
  } | null
  lat: number | null
  lon: number | null
  heading: number | null
  speed: number | null
}

interface RoutePatternRaw {
  directionId: number | null
  vehiclePositions: VehiclePositionRaw[] | null
}

interface RouteRaw {
  gtfsId: string
  shortName: string | null
  patterns: RoutePatternRaw[] | null
}

interface VehiclePositionsQueryResponse {
  routes: (RouteRaw | null)[] | null
}

export function registerVehiclesRoutes(router: Router, deps: { db: NodePgDatabase; digitransitClient: DigitransitClient }): void {
  const { db, digitransitClient } = deps

  // One pattern resolver per registration. Its LRU lives in this closure so
  // tests that re-register the routes get an independent cache, and the
  // production app shares one resolver across all requests.
  const patternResolver = createPatternResolver(digitransitClient)

  router.get("/routes/:routeId/vehicles", async (req, res) => {
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
      const empty: VehiclesApiResponse = { vehicles: [] }
      res.send(empty)
      return
    }

    const rows: CuratedRow[] = curatedRows.map((r) => ({ routeId, stopId: r.stopId, lines: r.lines }))

    let resolved
    try {
      resolved = await resolveCuratedSet(rows, patternResolver)
    } catch (error) {
      if (error instanceof DigitransitUpstreamError) {
        console.error(`Digitransit upstream error resolving patterns for routeId=${String(routeId)}:`, error)
        res.status(502).send({ success: false, error: "Upstream Digitransit error" })
        return
      }
      throw error
    }

    if (resolved.unresolved.length > 0) {
      console.error(
        `Unresolved curated pairs for routeId=${String(routeId)}:`,
        resolved.unresolved.map((p) => ({ stopId: p.stopId, lineGtfsId: p.lineGtfsId }))
      )
      res.status(502).send({
        success: false,
        error: "Unresolved curated pairs",
        unresolved: resolved.unresolved.map((p) => ({ stopId: p.stopId, lineGtfsId: p.lineGtfsId })),
      })
      return
    }

    const lineDirections = resolved.lineDirections
    const key = cacheKeyForRoute({ routeId, kind: "vehicles", lineDirections })

    // Distinct line gtfs ids preserving order, used as upstream input.
    const routeIds: string[] = []
    const seen = new Set<string>()
    for (const tuple of lineDirections) {
      if (!seen.has(tuple.lineGtfsId)) {
        seen.add(tuple.lineGtfsId)
        routeIds.push(tuple.lineGtfsId)
      }
    }

    try {
      const response = await getOrFetch<VehiclesApiResponse>(key, VEHICLES_TTL_MS, async () => {
        const data = await digitransitClient.query<VehiclePositionsQueryResponse>(VEHICLE_POSITIONS_QUERY, { routeIds })
        return reshapeVehicles(data, resolved.lineDirections, resolved.curatedStopsByLineDirection)
      })
      res.send(response)
    } catch (error) {
      if (error instanceof DigitransitUpstreamError) {
        console.error(`Digitransit upstream error fetching vehicles for routeId=${String(routeId)}:`, error)
        res.status(502).send({ success: false, error: "Upstream Digitransit error" })
        return
      }
      throw error
    }
  })
}

function reshapeVehicles(
  data: VehiclePositionsQueryResponse,
  lineDirections: LineDirectionTuple[],
  curatedStopsByLineDirection: CuratedStopsForLineDirection[]
): VehiclesApiResponse {
  // Build the resolved-set lookups for the defensive direction filter.
  const allowedLines = new Set<string>()
  const allowedKey = new Set<string>()
  for (const tuple of lineDirections) {
    allowedLines.add(tuple.lineGtfsId)
    allowedKey.add(directionKey(tuple.lineGtfsId, tuple.direction))
  }

  // Curated stop ids per (line, direction), used by the passed-stop filter.
  const curatedStopsByKey = new Map<string, Set<string>>()
  for (const group of curatedStopsByLineDirection) {
    curatedStopsByKey.set(directionKey(group.lineGtfsId, group.direction), new Set(group.stopIds))
  }

  const vehicles: ApiVehicle[] = []
  for (const route of data.routes ?? []) {
    if (route === null) continue
    if (!allowedLines.has(route.gtfsId)) continue
    for (const pattern of route.patterns ?? []) {
      const direction = pattern.directionId
      if (direction !== 0 && direction !== 1) continue
      const key = directionKey(route.gtfsId, direction)
      if (!allowedKey.has(key)) continue
      const curatedStopIds = curatedStopsByKey.get(key) ?? new Set<string>()
      for (const position of pattern.vehiclePositions ?? []) {
        if (position.vehicleId === null) continue
        if (position.lat === null || position.lon === null) continue
        // The trip's route gtfs id may differ defensively; require it to match.
        const tripRouteGtfsId = position.trip?.route?.gtfsId
        if (tripRouteGtfsId !== undefined && tripRouteGtfsId !== route.gtfsId) continue
        if (!keepByPassedStop(position, curatedStopIds)) continue
        const lineShortName = position.trip?.route?.shortName ?? route.shortName ?? ""
        vehicles.push({
          id: position.vehicleId,
          lineGtfsId: route.gtfsId,
          lineShortName,
          lat: position.lat,
          lon: position.lon,
          bearing: position.heading,
          speedMs: position.speed,
        })
      }
    }
  }

  return { vehicles }
}

/**
 * Resolves a vehicle's trip context into the passed-stop keep/drop decision.
 * Locates the vehicle's current stop and the curated stops within its own trip
 * stop sequence, then defers to the pure rule. Missing context resolves to a
 * keep — the rule is conservative on uncertainty.
 */
function keepByPassedStop(position: VehiclePositionRaw, curatedStopIds: Set<string>): boolean {
  const positionByStop = new Map<string, number>()
  for (const stoptime of position.trip?.stoptimes ?? []) {
    const stopGtfsId = stoptime.stop?.gtfsId
    if (stopGtfsId === undefined || stoptime.stopPosition === null) continue
    if (!positionByStop.has(stopGtfsId)) {
      positionByStop.set(stopGtfsId, stoptime.stopPosition)
    }
  }

  const currentStopGtfsId = position.stopRelationship?.stop?.gtfsId
  const currentStopPosition = currentStopGtfsId === undefined ? null : (positionByStop.get(currentStopGtfsId) ?? null)

  const curatedStopPositions: number[] = []
  for (const stopId of curatedStopIds) {
    const pos = positionByStop.get(stopId)
    if (pos !== undefined) curatedStopPositions.push(pos)
  }

  return keepVehiclePastCuratedStops({ currentStopPosition, curatedStopPositions })
}

function directionKey(lineGtfsId: string, direction: 0 | 1): string {
  return `${lineGtfsId} ${String(direction)}`
}
