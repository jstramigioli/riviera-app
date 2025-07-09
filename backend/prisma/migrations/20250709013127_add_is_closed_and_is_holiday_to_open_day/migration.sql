-- AlterTable
ALTER TABLE "OpenDay" ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isHoliday" BOOLEAN NOT NULL DEFAULT false;
