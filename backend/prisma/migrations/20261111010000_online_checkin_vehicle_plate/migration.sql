-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnlineCheckInStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OnlineCheckIn" (
    "id" TEXT NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "status" "OnlineCheckInStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "vehiclePlate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OnlineCheckIn_token_key" ON "OnlineCheckIn"("token");
CREATE INDEX IF NOT EXISTS "OnlineCheckIn_reservationId_idx" ON "OnlineCheckIn"("reservationId");
CREATE INDEX IF NOT EXISTS "OnlineCheckIn_status_idx" ON "OnlineCheckIn"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OnlineCheckIn"
    ADD CONSTRAINT "OnlineCheckIn_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
