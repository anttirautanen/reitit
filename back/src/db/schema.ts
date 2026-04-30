import { geometry, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core"

export const routesTable = pgTable("routes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  originCoordinates: geometry("originCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
  destinationCoordinates: geometry("destinationCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
})

export const routeStopsTable = pgTable(
  "route_stops",
  {
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    stopId: text("stop_id").notNull(),
    lines: text("lines").array().notNull(),
  },
  (table) => [primaryKey({ columns: [table.routeId, table.stopId] })],
)
