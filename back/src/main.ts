import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import express from "express"
import { routesTable } from "./db/schema.ts"
import { ApiRoute, POI, RoutesApiResponse } from "./api.ts"
import { z } from "zod"
import { eq } from "drizzle-orm"

const app = express()
const port = "3000"

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set. Please set it to your PostgreSQL connection string.")
  process.exit(1)
}

const db = drizzle(process.env.DATABASE_URL)

const apiRouter = express.Router()

apiRouter.get("/routes", async (req, res) => {
  const routes = await db.select().from(routesTable)

  const response: RoutesApiResponse = {
    routes: routes.map((route): ApiRoute => {
      const origin = getPOI("origin", route.originCoordinates)
      const destination = getPOI("destination", route.destinationCoordinates)
      return {
        id: route.id,
        name: route.name,
        origin,
        destination,
      }
    }),
  }

  res.send(response)
})

const CoordinatesUpdateRequest = z.object({ coordinates: z.tuple([z.number(), z.number()]) })

apiRouter.put("/routes/:routeId/origin", express.json(), async (req, res) => {
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

apiRouter.put("/routes/:routeId/destination", express.json(), async (req, res) => {
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

apiRouter.get("/stops", async (req, res) => {
  const stopsResponse = await fetch("https://api.digitransit.fi/routing/v2/hsl/gtfs/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "digitransit-subscription-key": process.env.HSL_API_KEY,
    },
    body: JSON.stringify({
      query: `
        {
          stops {
            gtfsId
            name
            lat
            lon
          }
        }
      `,
    }),
  })

  if (!stopsResponse.ok) {
    res.status(500).send({ success: false, error: "Failed to fetch stops from external API" })
    return
  }

  try {
    const stops = await stopsResponse.json()
    if (stops && typeof stops === "object" && "data" in stops) {
      res.send(stops.data)
    } else {
      res.status(500).send({ success: false, error: "Unexpected stops response format" })
    }
  } catch (error) {
    console.error(error)
    res.status(500).send({ success: false, error: "Failed to parse stops response" })
    return
  }
})

function getPOI(name: string, coordinates: [number, number] | null): POI | null {
  if (coordinates === null) {
    return null
  }

  return { name, coordinates }
}

app.use("/api", apiRouter)

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
