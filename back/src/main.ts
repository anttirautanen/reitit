import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import express from "express"
import { routesTable } from "./db/schema.ts"
import { ApiRoute, POI, RoutesApiResponse } from "./api.ts"

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
      const origin = getPOI(route.originName, route.originCoordinates)
      const destination = getPOI(route.destinationName, route.destinationCoordinates)
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

function getPOI(name: string | null, coordinates: [number, number] | null): POI | null {
  if (name === null || coordinates === null) {
    return null
  }

  return { name, coordinates }
}

app.use("/api", apiRouter)

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
