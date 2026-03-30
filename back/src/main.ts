import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import express, { Request, Response, NextFunction } from "express"
import { routesTable } from "./db/schema.js"
import { ApiRoute, POI, RoutesApiResponse } from "./api.js"
import { z } from "zod"
import { eq } from "drizzle-orm"
import rateLimit from "express-rate-limit"
import { LRUCache } from "lru-cache"

const app = express()
const port = "3000"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set. Please set it to PostgreSQL connection string.")
  process.exit(1)
}

const DIGITRANSIT_API_KEY = process.env.DIGITRANSIT_API_KEY
if (!DIGITRANSIT_API_KEY) {
  console.error("DIGITRANSIT_API_KEY environment variable is not set. Please set it to Digitransit subscription key.")
  process.exit(1)
}

const db = drizzle(DATABASE_URL)

const tileCache = new LRUCache<string, Buffer>({
  max: 2000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
})

const apiRouter = express.Router()

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 2000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
})

type TileRequest = Request<{ z: string; x: string; y: string }>
const TILE_Z_MAX = 22
const validateTileRequest = (req: TileRequest, res: Response, next: NextFunction) => {
  const z = Number(req.params.z)
  const x = Number(req.params.x)
  const y = Number(req.params.y)

  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return res.status(400).send()
  }

  if (z < 0 || z > TILE_Z_MAX) {
    return res.status(400).send()
  }

  const n = 2 ** z
  if (x < 0 || x >= n || y < 0 || y >= n) {
    return res.status(400).send()
  }

  next()
}

apiRouter.get("/tiles/:z/:x/:y", limiter, validateTileRequest, async (req: TileRequest, res) => {
  const cacheKey = `${req.params.z}/${req.params.x}/${req.params.y}`
  const cached = tileCache.get(cacheKey)

  if (cached) {
    res.set("Content-Type", "image/png")
    res.set("Cache-Control", "public, max-age=86400, immutable") // 24 hours
    res.send(cached)
    return
  }

  const upstream = await fetch(`https://cdn.digitransit.fi/map/v3/hsl-map/${req.params.z}/${req.params.x}/${req.params.y}.png`, {
    headers: {
      "digitransit-subscription-key": DIGITRANSIT_API_KEY,
    },
  })

  if (!upstream.ok) {
    res.status(502).send()
    console.error("Failed to load tile from upstream:", upstream.status, upstream.statusText)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  tileCache.set(cacheKey, buffer)

  res.set("Content-Type", "image/png")
  res.set("Cache-Control", "public, max-age=86400, immutable") // 24 hours
  res.send(buffer)
})

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
      "digitransit-subscription-key": DIGITRANSIT_API_KEY,
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
