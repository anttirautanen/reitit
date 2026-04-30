import express, { Express } from "express"
import { Server } from "http"
import { AddressInfo } from "net"
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
import pg from "pg"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { registerRoutesRoutes } from "../routes/routes.js"
import { routeStopsTable } from "../db/schema.js"

function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL environment variable is not set. " +
        "Set it to a Postgres connection string for the integration test database, " +
        "e.g. TEST_DATABASE_URL=postgres://user@localhost:5433/dbname",
    )
  }
  return url
}

let pool: pg.Pool | null = null
let dbInstance: NodePgDatabase | null = null

export function getDb(): NodePgDatabase {
  if (dbInstance === null) {
    pool = new pg.Pool({ connectionString: getTestDatabaseUrl() })
    dbInstance = drizzle(pool)
  }
  return dbInstance
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const MIGRATIONS_FOLDER = resolve(__dirname, "../../drizzle")

export async function applyMigrations(): Promise<void> {
  const db = getDb()
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}

export async function truncateAll(): Promise<void> {
  const db = getDb()
  await db.execute(sql`TRUNCATE route_stops, routes RESTART IDENTITY CASCADE`)
}

export async function closeDb(): Promise<void> {
  if (pool !== null) {
    await pool.end()
    pool = null
    dbInstance = null
  }
}

export interface SeedRouteInput {
  name: string
  originCoordinates?: [number, number]
  destinationCoordinates?: [number, number]
}

export async function seedRoute(input: SeedRouteInput): Promise<{ id: number }> {
  const db = getDb()
  const rows = await db.execute<{ id: number }>(sql`
    INSERT INTO routes (name, "originCoordinates", "destinationCoordinates")
    VALUES (
      ${input.name},
      ${
        input.originCoordinates
          ? sql`ST_SetSRID(ST_MakePoint(${input.originCoordinates[0]}, ${input.originCoordinates[1]}), 4326)`
          : sql`NULL`
      },
      ${
        input.destinationCoordinates
          ? sql`ST_SetSRID(ST_MakePoint(${input.destinationCoordinates[0]}, ${input.destinationCoordinates[1]}), 4326)`
          : sql`NULL`
      }
    )
    RETURNING id
  `)
  return { id: rows.rows[0].id }
}

export interface SeedRouteStopInput {
  routeId: number
  stopId: string
  lines: string[]
}

export async function seedRouteStop(input: SeedRouteStopInput): Promise<void> {
  const db = getDb()
  await db.insert(routeStopsTable).values({
    routeId: input.routeId,
    stopId: input.stopId,
    lines: input.lines,
  })
}

export interface TestServer {
  url: string
  close: () => Promise<void>
}

export async function startTestServer(): Promise<TestServer> {
  const db = getDb()
  const app: Express = express()
  const apiRouter = express.Router()
  registerRoutesRoutes(apiRouter, { db })
  app.use("/api", apiRouter)

  const server: Server = await new Promise((resolveListen) => {
    const s = app.listen(0, () => {
      resolveListen(s)
    })
  })

  const address = server.address() as AddressInfo
  const url = `http://127.0.0.1:${String(address.port)}`

  return {
    url,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((err) => {
          if (err) rejectClose(err)
          else resolveClose()
        })
      }),
  }
}
