import { geometry, integer, pgTable, text, varchar } from "drizzle-orm/pg-core"

export const routesTable = pgTable("routes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  originName: varchar({ length: 255 }),
  originCoordinates: geometry("originCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
  destinationName: varchar({ length: 255 }),
  destinationCoordinates: geometry("destinationCoordinates", { type: "point", mode: "tuple", srid: 4326 }),
})
