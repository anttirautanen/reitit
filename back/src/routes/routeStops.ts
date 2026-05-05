import { and, eq } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import express, { Router } from "express"
import { z } from "zod"
import { ApiCuratedStop } from "../api.js"
import { routeStopsTable, routesTable } from "../db/schema.js"

// `lines: z.array(z.string().min(1)).min(1)` enforces the non-empty-lines invariant
// (no empty array, and no empty strings within the array). The same invariant is
// applied to both the add and update request schemas below.
const AddCuratedStopRequest = z.object({
  stopId: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
})

const UpdateRouteStopLinesRequest = z.object({
  lines: z.array(z.string().min(1)).min(1),
})

function parseRouteId(raw: string): number | null {
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function registerRouteStopsRoutes(router: Router, deps: { db: NodePgDatabase }): void {
  const { db } = deps

  router.post("/routes/:routeId/stops", express.json(), async (req, res) => {
    const routeId = parseRouteId(req.params.routeId)
    if (routeId === null) {
      res.status(400).send({ success: false, error: "Invalid route id" })
      return
    }

    const parseResult = AddCuratedStopRequest.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).send({ success: false, error: "Invalid stop or lines" })
      return
    }

    const { stopId, lines } = parseResult.data

    const existingRoute = await db.select({ id: routesTable.id }).from(routesTable).where(eq(routesTable.id, routeId)).limit(1)
    if (existingRoute.length === 0) {
      res.status(404).send({ success: false, error: "Route not found" })
      return
    }

    const inserted = await db
      .insert(routeStopsTable)
      .values({ routeId, stopId, lines })
      .onConflictDoUpdate({
        target: [routeStopsTable.routeId, routeStopsTable.stopId],
        set: { lines },
      })
      .returning()

    const row = inserted[0]
    const curatedStop: ApiCuratedStop = { stopId: row.stopId, lines: row.lines }
    res.send({ success: true, curatedStop })
  })

  router.put("/routes/:routeId/stops/:stopId", express.json(), async (req, res) => {
    const routeId = parseRouteId(req.params.routeId)
    if (routeId === null) {
      res.status(400).send({ success: false, error: "Invalid route id" })
      return
    }

    const parseResult = UpdateRouteStopLinesRequest.safeParse(req.body)
    if (!parseResult.success) {
      res.status(400).send({ success: false, error: "Invalid lines" })
      return
    }

    const { stopId } = req.params
    const { lines } = parseResult.data

    const updated = await db
      .update(routeStopsTable)
      .set({ lines })
      .where(and(eq(routeStopsTable.routeId, routeId), eq(routeStopsTable.stopId, stopId)))
      .returning()

    if (updated.length === 0) {
      const existingRoute = await db.select({ id: routesTable.id }).from(routesTable).where(eq(routesTable.id, routeId)).limit(1)
      if (existingRoute.length === 0) {
        res.status(404).send({ success: false, error: "Route not found" })
        return
      }
      res.status(404).send({ success: false, error: "Route stop not found" })
      return
    }

    const row = updated[0]
    const curatedStop: ApiCuratedStop = { stopId: row.stopId, lines: row.lines }
    res.send({ success: true, curatedStop })
  })

  router.delete("/routes/:routeId/stops/:stopId", async (req, res) => {
    const routeId = parseRouteId(req.params.routeId)
    if (routeId === null) {
      res.status(400).send({ success: false, error: "Invalid route id" })
      return
    }

    const { stopId } = req.params

    const deleted = await db
      .delete(routeStopsTable)
      .where(and(eq(routeStopsTable.routeId, routeId), eq(routeStopsTable.stopId, stopId)))
      .returning()

    if (deleted.length === 0) {
      const existingRoute = await db.select({ id: routesTable.id }).from(routesTable).where(eq(routesTable.id, routeId)).limit(1)
      if (existingRoute.length === 0) {
        res.status(404).send({ success: false, error: "Route not found" })
        return
      }
      res.status(404).send({ success: false, error: "Route stop not found" })
      return
    }

    res.send({ success: true })
  })
}
