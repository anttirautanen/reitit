import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { DeparturesApiResponse } from "../api.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { STOP_DEPARTURES_QUERY } from "../digitransit/queries.js"
import { __resetCache } from "../realtime/cache.js"
import { registerDeparturesRoutes } from "../routes/departures.js"
import { registerRouteStopsRoutes } from "../routes/routeStops.js"
import { applyMigrations, closeDb, getDb, seedRoute, seedRouteStop, startTestServer, truncateAll, type TestServer } from "./setup.js"

interface FakeCall {
  query: string
  variables?: Record<string, unknown>
}

interface FakeClient extends DigitransitClient {
  calls: FakeCall[]
}

function fakeClient(impl: (query: string, variables?: Record<string, unknown>) => unknown): FakeClient {
  const calls: FakeCall[] = []
  return {
    query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      calls.push({ query, variables })
      try {
        return Promise.resolve(impl(query, variables) as T)
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },
    calls,
  }
}

interface ErrorResponse {
  success: false
  error: string
}

describe("GET /api/routes/:routeId/departures", () => {
  let server: TestServer | undefined
  let activeClient: FakeClient | undefined

  beforeAll(async () => {
    await applyMigrations()
    server = await startTestServer((router) => {
      const db = getDb()
      // Indirection: per-test we swap `activeClient` so that registering the
      // server once at suite scope still gives each test its own fake.
      const proxyClient: DigitransitClient = {
        query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
          if (activeClient === undefined) {
            return Promise.reject(new Error("no active fake digitransit client for this test"))
          }
          return activeClient.query<T>(query, variables)
        },
      }
      registerRouteStopsRoutes(router, { db })
      registerDeparturesRoutes(router, { db, digitransitClient: proxyClient })
    })
  })

  afterAll(async () => {
    if (server !== undefined) {
      await server.close()
    }
    await closeDb()
  })

  beforeEach(async () => {
    await truncateAll()
    __resetCache()
    activeClient = undefined
  })

  afterEach(() => {
    vi.useRealTimers()
    activeClient = undefined
  })

  function getServerUrl(): string {
    if (server === undefined) throw new Error("test server not initialised")
    return server.url
  }

  it("returns reshaped ISO-8601 departures with the realtime flag preserved", async () => {
    // Pin to a known instant so `serviceDay` math is deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-30T05:00:00Z"))

    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A"] })
    await seedRouteStop({ routeId, stopId: "HSL:2", lines: ["HSL:B"] })

    // 2026-04-30 local Helsinki midnight (UTC+3 DST) = 2026-04-29T21:00:00Z
    // = 1777834800 epoch seconds.
    const serviceDay = Math.floor(Date.UTC(2026, 3, 29, 21, 0, 0) / 1000)

    activeClient = fakeClient((_query, variables) => {
      const stopIds = variables?.stopIds as string[]
      const responseStops = stopIds.map((stopId) => {
        if (stopId === "HSL:1") {
          return {
            gtfsId: "HSL:1",
            stoptimesWithoutPatterns: [
              {
                scheduledDeparture: 25200, // 07:00:00 local
                realtimeDeparture: 25260, // 07:01:00 local (1 min late)
                realtime: true,
                serviceDay,
                headsign: "Center",
                trip: { route: { gtfsId: "HSL:A", shortName: "A" } },
              },
              {
                scheduledDeparture: 26100, // 07:15:00
                realtimeDeparture: 26100,
                realtime: false,
                serviceDay,
                headsign: "Center",
                trip: { route: { gtfsId: "HSL:A", shortName: "A" } },
              },
            ],
          }
        }
        if (stopId === "HSL:2") {
          return {
            gtfsId: "HSL:2",
            stoptimesWithoutPatterns: [
              {
                scheduledDeparture: 28800, // 08:00:00
                realtimeDeparture: 28800,
                realtime: true,
                serviceDay,
                headsign: "Suburb",
                trip: { route: { gtfsId: "HSL:B", shortName: "B" } },
              },
              {
                scheduledDeparture: 30600, // 08:30:00
                realtimeDeparture: 30600,
                realtime: false,
                serviceDay,
                headsign: "Suburb",
                trip: { route: { gtfsId: "HSL:B", shortName: "B" } },
              },
            ],
          }
        }
        return null
      })
      return { stops: responseStops }
    })

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as DeparturesApiResponse

    expect(body.stops).toHaveLength(2)
    expect(body.stops[0].stopId).toBe("HSL:1")
    expect(body.stops[0].lines).toHaveLength(1)
    expect(body.stops[0].lines[0]).toEqual({
      gtfsId: "HSL:A",
      shortName: "A",
      departures: [
        {
          scheduledAt: "2026-04-30T04:00:00.000Z",
          realtimeAt: "2026-04-30T04:01:00.000Z",
          isRealtime: true,
          headsign: "Center",
        },
        {
          scheduledAt: "2026-04-30T04:15:00.000Z",
          realtimeAt: "2026-04-30T04:15:00.000Z",
          isRealtime: false,
          headsign: "Center",
        },
      ],
    })

    expect(body.stops[1].stopId).toBe("HSL:2")
    expect(body.stops[1].lines).toHaveLength(1)
    expect(body.stops[1].lines[0].gtfsId).toBe("HSL:B")
    expect(body.stops[1].lines[0].departures[0].isRealtime).toBe(true)
    expect(body.stops[1].lines[0].departures[0].headsign).toBe("Suburb")

    expect(activeClient.calls).toHaveLength(1)
    expect(activeClient.calls[0].query).toBe(STOP_DEPARTURES_QUERY)
    expect(activeClient.calls[0].variables).toEqual({ stopIds: ["HSL:1", "HSL:2"] })
  })

  it("filters out lines that are not in the curated set", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-30T05:00:00Z"))

    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A"] })

    const serviceDay = Math.floor(Date.UTC(2026, 3, 29, 21, 0, 0) / 1000)

    activeClient = fakeClient(() => ({
      stops: [
        {
          gtfsId: "HSL:1",
          stoptimesWithoutPatterns: [
            {
              scheduledDeparture: 25200,
              realtimeDeparture: 25200,
              realtime: false,
              serviceDay,
              headsign: "Center",
              trip: { route: { gtfsId: "HSL:A", shortName: "A" } },
            },
            {
              scheduledDeparture: 25500,
              realtimeDeparture: 25500,
              realtime: false,
              serviceDay,
              headsign: "Other",
              trip: { route: { gtfsId: "HSL:NOT-CURATED", shortName: "X" } },
            },
          ],
        },
      ],
    }))

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as DeparturesApiResponse

    expect(body.stops).toHaveLength(1)
    expect(body.stops[0].lines).toHaveLength(1)
    expect(body.stops[0].lines[0].gtfsId).toBe("HSL:A")
    expect(body.stops[0].lines[0].departures.map((d) => d.headsign)).toEqual(["Center"])
  })

  it("omits curated lines with no upstream departures (stop bucket kept, empty lines allowed)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-30T05:00:00Z"))

    const { id: routeId } = await seedRoute({ name: "Route" })
    // Two curated lines on the same stop; upstream returns data only for HSL:A.
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A", "HSL:B"] })

    const serviceDay = Math.floor(Date.UTC(2026, 3, 29, 21, 0, 0) / 1000)
    activeClient = fakeClient(() => ({
      stops: [
        {
          gtfsId: "HSL:1",
          stoptimesWithoutPatterns: [
            {
              scheduledDeparture: 25200,
              realtimeDeparture: 25200,
              realtime: false,
              serviceDay,
              headsign: "Center",
              trip: { route: { gtfsId: "HSL:A", shortName: "A" } },
            },
          ],
        },
      ],
    }))

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as DeparturesApiResponse

    expect(body.stops).toHaveLength(1)
    expect(body.stops[0].stopId).toBe("HSL:1")
    expect(body.stops[0].lines).toHaveLength(1)
    expect(body.stops[0].lines[0].gtfsId).toBe("HSL:A")
    // The un-served curated line is absent (no empty-bucket placeholder).
    expect(body.stops[0].lines.some((l) => l.gtfsId === "HSL:B")).toBe(false)
  })

  it("serves the second GET from cache (fake called once)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-30T05:00:00Z"))

    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A"] })

    const serviceDay = Math.floor(Date.UTC(2026, 3, 29, 21, 0, 0) / 1000)
    activeClient = fakeClient(() => ({
      stops: [
        {
          gtfsId: "HSL:1",
          stoptimesWithoutPatterns: [
            {
              scheduledDeparture: 25200,
              realtimeDeparture: 25200,
              realtime: false,
              serviceDay,
              headsign: "Center",
              trip: { route: { gtfsId: "HSL:A", shortName: "A" } },
            },
          ],
        },
      ],
    }))

    const r1 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(r1.status).toBe(200)
    const r2 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(r2.status).toBe(200)

    expect(activeClient.calls).toHaveLength(1)
  })

  it("evicts when the curated set changes via /api/routes/:id/stops POST (cache key changes)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-30T05:00:00Z"))

    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A"] })

    const serviceDay = Math.floor(Date.UTC(2026, 3, 29, 21, 0, 0) / 1000)
    activeClient = fakeClient((_query, variables) => {
      const stopIds = variables?.stopIds as string[]
      return {
        stops: stopIds.map((stopId) => ({
          gtfsId: stopId,
          stoptimesWithoutPatterns: [
            {
              scheduledDeparture: 25200,
              realtimeDeparture: 25200,
              realtime: false,
              serviceDay,
              headsign: "Center",
              trip: { route: { gtfsId: stopId === "HSL:1" ? "HSL:A" : "HSL:B", shortName: "X" } },
            },
          ],
        })),
      }
    })

    const r1 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(r1.status).toBe(200)

    const post = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stopId: "HSL:2", lines: ["HSL:B"] }),
    })
    expect(post.status).toBe(200)

    const r2 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(r2.status).toBe(200)

    expect(activeClient.calls).toHaveLength(2)
  })

  it("returns 502 when the upstream throws DigitransitUpstreamError", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1", lines: ["HSL:A"] })

    activeClient = fakeClient(() => {
      throw new DigitransitUpstreamError("upstream went bad", { upstreamStatus: 500 })
    })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(response.status).toBe(502)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Upstream Digitransit error" })

    errorSpy.mockRestore()
  })

  it("returns 200 with empty stops and does not call the upstream when no curated stops exist", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    activeClient = fakeClient(() => {
      throw new Error("upstream should not be called")
    })

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/departures`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as DeparturesApiResponse
    expect(body).toEqual({ stops: [] })
    expect(activeClient.calls).toHaveLength(0)
  })

  it("returns 400 when the route id is not a number", async () => {
    activeClient = fakeClient(() => ({ stops: [] }))

    const response = await fetch(`${getServerUrl()}/api/routes/abc/departures`)
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Invalid route id" })
    expect(activeClient.calls).toHaveLength(0)
  })

  it("returns 404 when the route does not exist", async () => {
    activeClient = fakeClient(() => ({ stops: [] }))

    const response = await fetch(`${getServerUrl()}/api/routes/999999/departures`)
    expect(response.status).toBe(404)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Route not found" })
    expect(activeClient.calls).toHaveLength(0)
  })
})
