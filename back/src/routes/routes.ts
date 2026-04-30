import { asc, eq } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import express, { Router } from "express"
import { z } from "zod"
import { ApiCuratedStop, ApiRoute, POI, RoutesApiResponse } from "../api.js"
import { routeStopsTable, routesTable } from "../db/schema.js"

const CoordinatesUpdateRequest = z.object({ coordinates: z.tuple([z.number(), z.number()]) })

export function registerRoutesRoutes(router: Router, deps: { db: NodePgDatabase }): void {
  const { db } = deps

  router.get("/routes", async (req, res) => {
    const [routes, routeStops] = await Promise.all([
      db.select().from(routesTable),
      db.select().from(routeStopsTable).orderBy(asc(routeStopsTable.stopId)),
    ])

    const curatedStopsByRouteId = new Map<number, ApiCuratedStop[]>()
    for (const routeStop of routeStops) {
      const list = curatedStopsByRouteId.get(routeStop.routeId) ?? []
      list.push({ stopId: routeStop.stopId, lines: routeStop.lines })
      curatedStopsByRouteId.set(routeStop.routeId, list)
    }

    const response: RoutesApiResponse = {
      routes: routes.map((route): ApiRoute => {
        const origin = getPOI("origin", route.originCoordinates)
        const destination = getPOI("destination", route.destinationCoordinates)
        return {
          id: route.id,
          name: route.name,
          origin,
          destination,
          curatedStops: curatedStopsByRouteId.get(route.id) ?? [],
        }
      }),
    }

    res.send(response)
  })

  router.put("/routes/:routeId/origin", express.json(), async (req, res) => {
    const routeId = req.params.routeId
    const parseResult = CoordinatesUpdateRequest.safeParse(req.body)

    if (!parseResult.success) {
      res.status(400).send({ success: false, error: "Invalid coordinates" })
      return
    }

    await db
      .update(routesTable)
      .set({ originCoordinates: parseResult.data.coordinates })
      .where(eq(routesTable.id, parseInt(routeId, 10)))

    res.send({ success: true })
  })

  router.put("/routes/:routeId/destination", express.json(), async (req, res) => {
    const routeId = req.params.routeId
    const parseResult = CoordinatesUpdateRequest.safeParse(req.body)

    if (!parseResult.success) {
      res.status(400).send({ success: false, error: "Invalid coordinates" })
      return
    }

    await db
      .update(routesTable)
      .set({ destinationCoordinates: parseResult.data.coordinates })
      .where(eq(routesTable.id, parseInt(routeId, 10)))

    res.send({ success: true })
  })
}

function getPOI(name: string, coordinates: [number, number] | null): POI | null {
  if (coordinates === null) {
    return null
  }

  return { name, coordinates }
}
