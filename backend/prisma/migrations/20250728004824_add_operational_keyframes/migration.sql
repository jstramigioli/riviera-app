-- AlterTable
ALTER TABLE "SeasonalKeyframe" ADD COLUMN     "isOperational" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operationalType" TEXT,
ADD COLUMN     "periodId" TEXT;
