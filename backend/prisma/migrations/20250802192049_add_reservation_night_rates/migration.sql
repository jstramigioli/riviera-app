-- CreateTable
CREATE TABLE "public"."ReservationNightRate" (
    "id" TEXT NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "dynamicRate" DOUBLE PRECISION NOT NULL,
    "finalRate" DOUBLE PRECISION NOT NULL,
    "serviceType" TEXT NOT NULL,
    "serviceRate" DOUBLE PRECISION NOT NULL,
    "occupancyScore" DOUBLE PRECISION,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "gapPromotionApplied" BOOLEAN NOT NULL DEFAULT false,
    "gapPromotionRate" DOUBLE PRECISION,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "occupancyAdjustment" DOUBLE PRECISION,
    "weekendAdjustment" DOUBLE PRECISION,
    "holidayAdjustment" DOUBLE PRECISION,
    "gapPromotionAmount" DOUBLE PRECISION,
    "serviceAdjustment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationNightRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReservationNightRate_reservationId_date_key" ON "public"."ReservationNightRate"("reservationId", "date");

-- AddForeignKey
ALTER TABLE "public"."ReservationNightRate" ADD CONSTRAINT "ReservationNightRate_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
