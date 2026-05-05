import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import express from "express"
import { createDigitransitClient } from "./digitransit/client.js"
import { registerDeparturesRoutes } from "./routes/departures.js"
import { registerRouteStopsRoutes } from "./routes/routeStops.js"
import { registerRoutesRoutes } from "./routes/routes.js"
import { registerStopLinesRoutes } from "./routes/stopLines.js"
import { registerStopsRoutes } from "./routes/stops.js"
import { registerTileRoutes } from "./routes/tiles.js"

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
const digitransitClient = createDigitransitClient({ apiKey: DIGITRANSIT_API_KEY })

const apiRouter = express.Router()

registerTileRoutes(apiRouter, { digitransitApiKey: DIGITRANSIT_API_KEY })
registerRoutesRoutes(apiRouter, { db })
registerRouteStopsRoutes(apiRouter, { db })
registerDeparturesRoutes(apiRouter, { db, digitransitClient })
registerStopsRoutes(apiRouter, { digitransitApiKey: DIGITRANSIT_API_KEY })
registerStopLinesRoutes(apiRouter, { digitransitClient })

app.use("/api", apiRouter)

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
