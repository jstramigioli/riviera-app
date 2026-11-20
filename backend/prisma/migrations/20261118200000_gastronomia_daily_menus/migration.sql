-- CreateEnum
CREATE TYPE "DailyMenuKind" AS ENUM ('CONVENTIONAL', 'BUFFET');

-- CreateEnum
CREATE TYPE "DailyMenuStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "DailyMenuSection" AS ENUM ('ENTRADA', 'ENSALADA', 'PRIMER_PLATO', 'SEGUNDO_PLATO', 'POSTRE', 'BUFFET');

-- CreateTable
CREATE TABLE "DishCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameNorm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DishCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMenu" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "kind" "DailyMenuKind" NOT NULL,
    "status" "DailyMenuStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMenuItem" (
    "id" SERIAL NOT NULL,
    "dailyMenuId" INTEGER NOT NULL,
    "section" "DailyMenuSection" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "nameSnapshot" TEXT NOT NULL,
    "descriptionSnap" TEXT,
    "dishCatalogId" INTEGER,

    CONSTRAINT "DailyMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DishCatalog_nameNorm_key" ON "DishCatalog"("nameNorm");

-- CreateIndex
CREATE INDEX "DishCatalog_lastUsedAt_idx" ON "DishCatalog"("lastUsedAt");

-- CreateIndex
CREATE INDEX "DishCatalog_usageCount_idx" ON "DishCatalog"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_date_key" ON "DailyMenu"("date");

-- CreateIndex
CREATE INDEX "DailyMenu_status_date_idx" ON "DailyMenu"("status", "date");

-- CreateIndex
CREATE INDEX "DailyMenuItem_dailyMenuId_section_sortOrder_idx" ON "DailyMenuItem"("dailyMenuId", "section", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyMenuItem_dishCatalogId_idx" ON "DailyMenuItem"("dishCatalogId");

-- AddForeignKey
ALTER TABLE "DailyMenuItem" ADD CONSTRAINT "DailyMenuItem_dailyMenuId_fkey" FOREIGN KEY ("dailyMenuId") REFERENCES "DailyMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMenuItem" ADD CONSTRAINT "DailyMenuItem_dishCatalogId_fkey" FOREIGN KEY ("dishCatalogId") REFERENCES "DishCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
