ALTER TABLE "routes" ALTER COLUMN "originName" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ALTER COLUMN "originCoordinates" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ALTER COLUMN "destinationName" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ALTER COLUMN "destinationCoordinates" DROP NOT NULL;