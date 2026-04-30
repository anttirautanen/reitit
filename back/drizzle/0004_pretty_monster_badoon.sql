CREATE TABLE "route_stops" (
	"route_id" integer NOT NULL,
	"stop_id" text NOT NULL,
	"lines" text[] NOT NULL,
	CONSTRAINT "route_stops_route_id_stop_id_pk" PRIMARY KEY("route_id","stop_id")
);
--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;