import { eq } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import express, { Router } from "express"
import { z } from "zod"
import { ApiCuratedStop } from "../api.js"
import { routeStopsTable, routesTable } from "../db/schema.js"

// `lines: z.array(z.string().min(1)).min(1)` enforces the non-empty-lines invariant
// (no empty array, and no empty strings within the array).
const AddCuratedStopRequest = z.object({
  stopId: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
})

export function registerRouteStopsRoutes(router: Router, deps: { db: NodePgDatabase }): void {
  const { db } = deps

  router.post("/routes/:routeId/stops", express.json(), async (req, res) => {
    const routeId = parseInt(req.params.routeId, 10)
    if (Number.isNaN(routeId)) {
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
}
