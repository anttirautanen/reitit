import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { VehiclesApiResponse } from "../api.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { STOP_PATTERNS_QUERY, VEHICLE_POSITIONS_QUERY } from "../digitransit/queries.js"
import { __resetCache } from "../realtime/cache.js"
import { registerVehiclesRoutes } from "../routes/vehicles.js"
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
  unresolved?: { stopId: string; lineGtfsId: string }[]
}

describe("GET /api/routes/:routeId/vehicles", () => {
  let server: TestServer | undefined
  let activeClient: FakeClient | undefined

  beforeAll(async () => {
    await applyMigrations()
    server = await startTestServer((router) => {
      const db = getDb()
      const proxyClient: DigitransitClient = {
        query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
          if (activeClient === undefined) {
            return Promise.reject(new Error("no active fake digitransit client for this test"))
          }
          return activeClient.query<T>(query, variables)
        },
      }
      registerVehiclesRoutes(router, { db, digitransitClient: proxyClient })
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

  it("filters vehicles by (lineGtfsId, direction) against the resolved set", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:filter-1", lines: ["line-A"] })
    await seedRouteStop({ routeId, stopId: "HSL:filter-2", lines: ["line-B"] })

    activeClient = fakeClient((query, variables) => {
      if (query === STOP_PATTERNS_QUERY) {
        const stopId = variables?.stopId as string
        if (stopId === "HSL:filter-1") {
          return { stop: { patterns: [{ route: { gtfsId: "line-A" }, directionId: 0 }] } }
        }
        if (stopId === "HSL:filter-2") {
          return { stop: { patterns: [{ route: { gtfsId: "line-B" }, directionId: 1 }] } }
        }
        return { stop: null }
      }
      if (query === VEHICLE_POSITIONS_QUERY) {
        return {
          routes: [
            {
              gtfsId: "line-A",
              shortName: "A",
              patterns: [
                {
                  directionId: 0,
                  vehiclePositions: [
                    {
                      vehicleId: "v-A0",
                      trip: { route: { gtfsId: "line-A", shortName: "A" } },
                      direction: 0,
                      lat: 60.1,
                      lon: 24.9,
                      heading: 90,
                      speed: 5,
                    },
                  ],
                },
                {
                  directionId: 1,
                  vehiclePositions: [
                    {
                      vehicleId: "v-A1",
                      trip: { route: { gtfsId: "line-A", shortName: "A" } },
                      direction: 1,
                      lat: 60.2,
                      lon: 24.95,
                      heading: 270,
                      speed: 6,
                    },
                  ],
                },
              ],
            },
            {
              gtfsId: "line-B",
              shortName: "B",
              patterns: [
                {
                  directionId: 1,
                  vehiclePositions: [
                    {
                      vehicleId: "v-B1",
                      trip: { route: { gtfsId: "line-B", shortName: "B" } },
                      direction: 1,
                      lat: 60.3,
                      lon: 24.7,
                      heading: 180,
                      speed: 7,
                    },
                  ],
                },
              ],
            },
            {
              gtfsId: "line-C",
              shortName: "C",
              patterns: [
                {
                  directionId: 0,
                  vehiclePositions: [
                    {
                      vehicleId: "v-C0",
                      trip: { route: { gtfsId: "line-C", shortName: "C" } },
                      direction: 0,
                      lat: 60.4,
                      lon: 24.6,
                      heading: 0,
                      speed: 3,
                    },
                  ],
                },
              ],
            },
          ],
        }
      }
      throw new Error(`unexpected query: ${query}`)
    })

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as VehiclesApiResponse

    expect(body.vehicles).toHaveLength(2)
    const ids = body.vehicles.map((v) => v.id).sort()
    expect(ids).toEqual(["v-A0", "v-B1"])

    const a = body.vehicles.find((v) => v.id === "v-A0")
    expect(a).toEqual({
      id: "v-A0",
      lineGtfsId: "line-A",
      lineShortName: "A",
      lat: 60.1,
      lon: 24.9,
      bearing: 90,
      speedMs: 5,
    })
  })

  it("serves the second GET from cache (vehicles fetcher called once)", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:cache-1", lines: ["line-A"] })

    activeClient = fakeClient((query, variables) => {
      if (query === STOP_PATTERNS_QUERY) {
        const stopId = variables?.stopId as string
        if (stopId === "HSL:cache-1") {
          return { stop: { patterns: [{ route: { gtfsId: "line-A" }, directionId: 0 }] } }
        }
        return { stop: null }
      }
      if (query === VEHICLE_POSITIONS_QUERY) {
        return {
          routes: [
            {
              gtfsId: "line-A",
              shortName: "A",
              patterns: [
                {
                  directionId: 0,
                  vehiclePositions: [
                    {
                      vehicleId: "v-A0",
                      trip: { route: { gtfsId: "line-A", shortName: "A" } },
                      direction: 0,
                      lat: 60.1,
                      lon: 24.9,
                      heading: 90,
                      speed: 5,
                    },
                  ],
                },
              ],
            },
          ],
        }
      }
      throw new Error(`unexpected query: ${query}`)
    })

    const r1 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(r1.status).toBe(200)
    const r2 = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(r2.status).toBe(200)

    const vehicleCalls = activeClient.calls.filter((c) => c.query === VEHICLE_POSITIONS_QUERY)
    expect(vehicleCalls).toHaveLength(1)
  })

  it("returns 502 when the upstream throws DigitransitUpstreamError on the vehicles call", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:upstream-1", lines: ["line-A"] })

    activeClient = fakeClient((query, variables) => {
      if (query === STOP_PATTERNS_QUERY) {
        const stopId = variables?.stopId as string
        if (stopId === "HSL:upstream-1") {
          return { stop: { patterns: [{ route: { gtfsId: "line-A" }, directionId: 0 }] } }
        }
        return { stop: null }
      }
      if (query === VEHICLE_POSITIONS_QUERY) {
        throw new DigitransitUpstreamError("upstream went bad", { upstreamStatus: 500 })
      }
      throw new Error(`unexpected query: ${query}`)
    })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(response.status).toBe(502)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Upstream Digitransit error" })

    errorSpy.mockRestore()
  })

  it("returns 502 with the unresolved list when the pattern resolver returns null for a curated pair", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:unresolved-1", lines: ["line-A"] })
    await seedRouteStop({ routeId, stopId: "HSL:unresolved-2", lines: ["line-B"] })

    activeClient = fakeClient((query, variables) => {
      if (query === STOP_PATTERNS_QUERY) {
        const stopId = variables?.stopId as string
        if (stopId === "HSL:unresolved-1") {
          return { stop: { patterns: [{ route: { gtfsId: "line-A" }, directionId: 0 }] } }
        }
        if (stopId === "HSL:unresolved-2") {
          // No patterns serving line-B at this stop -> pair is unresolved.
          return { stop: { patterns: [] } }
        }
        return { stop: null }
      }
      if (query === VEHICLE_POSITIONS_QUERY) {
        throw new Error("vehicles fetcher should not be called when there are unresolved pairs")
      }
      throw new Error(`unexpected query: ${query}`)
    })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(response.status).toBe(502)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({
      success: false,
      error: "Unresolved curated pairs",
      unresolved: [{ stopId: "HSL:unresolved-2", lineGtfsId: "line-B" }],
    })

    errorSpy.mockRestore()
  })

  it("returns 400 when the route id is not a number", async () => {
    activeClient = fakeClient(() => ({ vehicles: [] }))

    const response = await fetch(`${getServerUrl()}/api/routes/abc/vehicles`)
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Invalid route id" })
    expect(activeClient.calls).toHaveLength(0)
  })

  it("returns 404 when the route does not exist", async () => {
    activeClient = fakeClient(() => ({ vehicles: [] }))

    const response = await fetch(`${getServerUrl()}/api/routes/999999/vehicles`)
    expect(response.status).toBe(404)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Route not found" })
    expect(activeClient.calls).toHaveLength(0)
  })

  it("returns 200 with empty vehicles and does not call the upstream when no curated stops exist", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    activeClient = fakeClient(() => {
      throw new Error("upstream should not be called")
    })

    const response = await fetch(`${getServerUrl()}/api/routes/${String(routeId)}/vehicles`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as VehiclesApiResponse
    expect(body).toEqual({ vehicles: [] })
    expect(activeClient.calls).toHaveLength(0)
  })
})
