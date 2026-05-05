import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { RoutesApiResponse } from "../api.js"
import { registerRoutesRoutes } from "../routes/routes.js"
import {
  applyMigrations,
  closeDb,
  getDb,
  seedRoute,
  seedRouteStop,
  startTestServer,
  truncateAll,
  type TestServer,
} from "./setup.js"

describe("GET /api/routes", () => {
  let server: TestServer | undefined

  beforeAll(async () => {
    await applyMigrations()
    server = await startTestServer((router) => registerRoutesRoutes(router, { db: getDb() }))
  })

  afterAll(async () => {
    if (server !== undefined) {
      await server.close()
    }
    await closeDb()
  })

  beforeEach(async () => {
    await truncateAll()
  })

  async function fetchRoutes(): Promise<RoutesApiResponse> {
    if (server === undefined) throw new Error("test server not initialised")
    const response = await fetch(`${server.url}/api/routes`)
    expect(response.ok).toBe(true)
    return (await response.json()) as RoutesApiResponse
  }

  it("returns curatedStops as an empty array for routes with no route_stops", async () => {
    await seedRoute({ name: "Empty route" })

    const body = await fetchRoutes()

    expect(body.routes).toHaveLength(1)
    expect(body.routes[0].name).toBe("Empty route")
    expect(body.routes[0].curatedStops).toEqual([])
  })

  it("returns route_stops sorted by stopId ascending with their lines", async () => {
    const { id: routeId } = await seedRoute({ name: "Populated route" })
    await seedRouteStop({ routeId, stopId: "HSL:2222222", lines: ["HSL:550", "HSL:1078"] })
    await seedRouteStop({ routeId, stopId: "HSL:1111111", lines: ["HSL:550"] })

    const body = await fetchRoutes()

    expect(body.routes).toHaveLength(1)
    expect(body.routes[0].curatedStops).toEqual([
      { stopId: "HSL:1111111", lines: ["HSL:550"] },
      { stopId: "HSL:2222222", lines: ["HSL:550", "HSL:1078"] },
    ])
  })

  it("returns curatedStops correctly across multiple routes", async () => {
    const { id: routeAId } = await seedRoute({ name: "Route A" })
    const { id: routeBId } = await seedRoute({ name: "Route B" })
    await seedRouteStop({ routeId: routeAId, stopId: "HSL:AAA", lines: ["HSL:1"] })
    await seedRouteStop({ routeId: routeAId, stopId: "HSL:BBB", lines: ["HSL:2"] })
    // Route B has no curated stops

    const body = await fetchRoutes()

    const routeA = body.routes.find((r) => r.id === routeAId)
    const routeB = body.routes.find((r) => r.id === routeBId)
    expect(routeA).toBeDefined()
    expect(routeB).toBeDefined()
    expect(routeA?.curatedStops).toEqual([
      { stopId: "HSL:AAA", lines: ["HSL:1"] },
      { stopId: "HSL:BBB", lines: ["HSL:2"] },
    ])
    expect(routeB?.curatedStops).toEqual([])
  })

  it("preserves the existing id, name, origin, and destination fields on a route", async () => {
    const { id } = await seedRoute({
      name: "Detailed route",
      originCoordinates: [24.93, 60.17],
      destinationCoordinates: [24.95, 60.19],
    })

    const body = await fetchRoutes()

    const route = body.routes.find((r) => r.id === id)
    expect(route).toBeDefined()
    expect(route?.name).toBe("Detailed route")
    expect(route?.origin).toEqual({ name: "origin", coordinates: [24.93, 60.17] })
    expect(route?.destination).toEqual({ name: "destination", coordinates: [24.95, 60.19] })
  })
})
