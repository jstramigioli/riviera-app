-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BedType" AS ENUM ('double', 'single');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoomBed" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "bedType" "BedType" NOT NULL,
    "isSeparable" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoomBed_pkey" PRIMARY KEY ("id")
);

-- AlterTable Query: preferencia de camas
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "bedPreferenceNone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "preferredDoubleBeds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "preferredSingleBeds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable ReservationSegment: preferencia de camas
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "bedPreferenceNone" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "preferredDoubleBeds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "preferredSingleBeds" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomBed_roomId_idx" ON "RoomBed"("roomId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RoomBed" ADD CONSTRAINT "RoomBed_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Defaults: camas según capacidad de la habitación (doble=2, resto single)
-- Solo para habitaciones sin camas aún.
INSERT INTO "RoomBed" ("roomId", "bedType", "isSeparable", "orderIndex")
SELECT
  r.id,
  CASE WHEN g.n <= (r."maxPeople" / 2) THEN 'double'::"BedType" ELSE 'single'::"BedType" END,
  false,
  g.n - 1
FROM "Room" r
CROSS JOIN LATERAL generate_series(
  1,
  GREATEST((r."maxPeople" / 2) + (r."maxPeople" % 2), 1)
) AS g(n)
WHERE NOT EXISTS (SELECT 1 FROM "RoomBed" b WHERE b."roomId" = r.id);
