import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { ApiCuratedStop, RoutesApiResponse } from "../api.js"
import { routeStopsTable } from "../db/schema.js"
import { registerRouteStopsRoutes } from "../routes/routeStops.js"
import { registerRoutesRoutes } from "../routes/routes.js"
import { applyMigrations, closeDb, getDb, seedRoute, seedRouteStop, startTestServer, truncateAll, type TestServer } from "./setup.js"

interface AddStopSuccessResponse {
  success: true
  curatedStop: ApiCuratedStop
}

interface ErrorResponse {
  success: false
  error: string
}

describe("POST /api/routes/:routeId/stops", () => {
  let server: TestServer | undefined

  beforeAll(async () => {
    await applyMigrations()
    server = await startTestServer((router, deps) => {
      registerRoutesRoutes(router, deps)
      registerRouteStopsRoutes(router, deps)
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
  })

  function getServerUrl(): string {
    if (server === undefined) throw new Error("test server not initialised")
    return server.url
  }

  async function postStop(routeId: number | string, body: unknown): Promise<Response> {
    return fetch(`${getServerUrl()}/api/routes/${String(routeId)}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  async function fetchRoutes(): Promise<RoutesApiResponse> {
    const response = await fetch(`${getServerUrl()}/api/routes`)
    expect(response.ok).toBe(true)
    return (await response.json()) as RoutesApiResponse
  }

  it("inserts a new curated stop and returns the canonical body (200)", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    const response = await postStop(routeId, { stopId: "HSL:1234567", lines: ["HSL:550", "HSL:1078"] })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AddStopSuccessResponse
    expect(body).toEqual({
      success: true,
      curatedStop: { stopId: "HSL:1234567", lines: ["HSL:550", "HSL:1078"] },
    })

    const routes = await fetchRoutes()
    const route = routes.routes.find((r) => r.id === routeId)
    expect(route?.curatedStops).toEqual([{ stopId: "HSL:1234567", lines: ["HSL:550", "HSL:1078"] }])
  })

  it("upserts an existing curated stop, replacing the lines (200)", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1234567", lines: ["HSL:550"] })

    const response = await postStop(routeId, { stopId: "HSL:1234567", lines: ["HSL:1078", "HSL:560"] })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AddStopSuccessResponse
    expect(body).toEqual({
      success: true,
      curatedStop: { stopId: "HSL:1234567", lines: ["HSL:1078", "HSL:560"] },
    })

    const routes = await fetchRoutes()
    const route = routes.routes.find((r) => r.id === routeId)
    expect(route?.curatedStops).toEqual([{ stopId: "HSL:1234567", lines: ["HSL:1078", "HSL:560"] }])

    const db = getDb()
    const rows = await db
      .select()
      .from(routeStopsTable)
      .where(and(eq(routeStopsTable.routeId, routeId), eq(routeStopsTable.stopId, "HSL:1234567")))
    expect(rows).toHaveLength(1)
  })

  it("returns 400 when lines is empty and inserts no row", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    const response = await postStop(routeId, { stopId: "HSL:1234567", lines: [] })
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe("string")

    const db = getDb()
    const rows = await db.select().from(routeStopsTable).where(eq(routeStopsTable.routeId, routeId))
    expect(rows).toHaveLength(0)
  })

  it("returns 400 when stopId is missing or lines contains a non-string", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    const missingStopId = await postStop(routeId, { lines: ["HSL:550"] })
    expect(missingStopId.status).toBe(400)
    const missingBody = (await missingStopId.json()) as ErrorResponse
    expect(missingBody.success).toBe(false)

    const badLines = await postStop(routeId, { stopId: "HSL:1234567", lines: ["HSL:550", 42] })
    expect(badLines.status).toBe(400)
    const badLinesBody = (await badLines.json()) as ErrorResponse
    expect(badLinesBody.success).toBe(false)

    const db = getDb()
    const rows = await db.select().from(routeStopsTable).where(eq(routeStopsTable.routeId, routeId))
    expect(rows).toHaveLength(0)
  })

  it("returns 400 when the route id is not a number", async () => {
    const response = await postStop("abc", { stopId: "HSL:1234567", lines: ["HSL:550"] })
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe("string")
  })

  it("returns 404 when the route does not exist", async () => {
    const response = await postStop(999999, { stopId: "HSL:1234567", lines: ["HSL:550"] })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Route not found" })
  })
})

describe("PUT /api/routes/:routeId/stops/:stopId", () => {
  let server: TestServer | undefined

  beforeAll(async () => {
    await applyMigrations()
    server = await startTestServer((router, deps) => {
      registerRoutesRoutes(router, deps)
      registerRouteStopsRoutes(router, deps)
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
  })

  function getServerUrl(): string {
    if (server === undefined) throw new Error("test server not initialised")
    return server.url
  }

  async function putStop(routeId: number | string, stopId: string, body: unknown): Promise<Response> {
    return fetch(`${getServerUrl()}/api/routes/${String(routeId)}/stops/${stopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  async function fetchRoutes(): Promise<RoutesApiResponse> {
    const response = await fetch(`${getServerUrl()}/api/routes`)
    expect(response.ok).toBe(true)
    return (await response.json()) as RoutesApiResponse
  }

  it("updates the lines on an existing curated stop and returns the canonical body (200)", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1234567", lines: ["HSL:550", "HSL:1078"] })

    const response = await putStop(routeId, "HSL:1234567", { lines: ["NEW-A", "NEW-B", "NEW-C"] })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AddStopSuccessResponse
    expect(body).toEqual({
      success: true,
      curatedStop: { stopId: "HSL:1234567", lines: ["NEW-A", "NEW-B", "NEW-C"] },
    })

    const routes = await fetchRoutes()
    const route = routes.routes.find((r) => r.id === routeId)
    expect(route?.curatedStops).toEqual([{ stopId: "HSL:1234567", lines: ["NEW-A", "NEW-B", "NEW-C"] }])
  })

  it("returns 400 when lines is empty and does not change the row", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1234567", lines: ["HSL:550", "HSL:1078"] })

    const response = await putStop(routeId, "HSL:1234567", { lines: [] })
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Invalid lines" })

    const db = getDb()
    const rows = await db
      .select()
      .from(routeStopsTable)
      .where(and(eq(routeStopsTable.routeId, routeId), eq(routeStopsTable.stopId, "HSL:1234567")))
    expect(rows).toHaveLength(1)
    expect(rows[0].lines).toEqual(["HSL:550", "HSL:1078"])
  })

  it("returns 400 when the lines field is missing", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })
    await seedRouteStop({ routeId, stopId: "HSL:1234567", lines: ["HSL:550"] })

    const response = await putStop(routeId, "HSL:1234567", {})
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body.success).toBe(false)
    expect(body.error).toBe("Invalid lines")
  })

  it("returns 400 when the route id is not a number", async () => {
    const response = await putStop("abc", "HSL:1234", { lines: ["HSL:550"] })
    expect(response.status).toBe(400)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Invalid route id" })
  })

  it("returns 404 when the route exists but no row exists for the stop", async () => {
    const { id: routeId } = await seedRoute({ name: "Route" })

    const response = await putStop(routeId, "HSL:9999", { lines: ["HSL:550"] })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Route stop not found" })

    const db = getDb()
    const rows = await db.select().from(routeStopsTable).where(eq(routeStopsTable.routeId, routeId))
    expect(rows).toHaveLength(0)
  })

  it("returns 404 when the route id refers to a non-existent route", async () => {
    const response = await putStop(999999, "HSL:1234", { lines: ["HSL:550"] })
    expect(response.status).toBe(404)
    const body = (await response.json()) as ErrorResponse
    expect(body).toEqual({ success: false, error: "Route not found" })
  })
})
