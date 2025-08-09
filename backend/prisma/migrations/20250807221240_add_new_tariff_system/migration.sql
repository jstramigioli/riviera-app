-- CreateEnum
CREATE TYPE "public"."ServiceAdjustmentMode" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "public"."SeasonBlock" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeasonPrice" (
    "id" TEXT NOT NULL,
    "seasonBlockId" TEXT NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceAdjustment" (
    "id" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "mode" "public"."ServiceAdjustmentMode" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonBlock_hotelId_name_key" ON "public"."SeasonBlock"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPrice_seasonBlockId_roomTypeId_key" ON "public"."SeasonPrice"("seasonBlockId", "roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_hotelId_name_key" ON "public"."ServiceType"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAdjustment_serviceTypeId_roomTypeId_key" ON "public"."ServiceAdjustment"("serviceTypeId", "roomTypeId");

-- AddForeignKey
ALTER TABLE "public"."SeasonBlock" ADD CONSTRAINT "SeasonBlock_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonPrice" ADD CONSTRAINT "SeasonPrice_seasonBlockId_fkey" FOREIGN KEY ("seasonBlockId") REFERENCES "public"."SeasonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonPrice" ADD CONSTRAINT "SeasonPrice_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceType" ADD CONSTRAINT "ServiceType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAdjustment" ADD CONSTRAINT "ServiceAdjustment_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAdjustment" ADD CONSTRAINT "ServiceAdjustment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
