CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "routes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "routes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" integer NOT NULL,
	"originName" varchar(255) NOT NULL,
	"originCoordinates" geometry(point) NOT NULL,
	"destinationName" varchar(255) NOT NULL,
	"destinationCoordinates" geometry(point) NOT NULL
);
