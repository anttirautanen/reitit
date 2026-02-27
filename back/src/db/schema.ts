import { geometry, integer, pgTable, text } from "drizzle-orm/pg-core"

export const routesTable = pgTable("routes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  originCoordinates: geometry("originCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
  destinationCoordinates: geometry("destinationCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
})
