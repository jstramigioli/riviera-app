-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "requiredRoomId" INTEGER,
ADD COLUMN     "requiredRoomTypeId" INTEGER,
ADD COLUMN     "requiredTags" TEXT[],
ADD COLUMN     "requirementsNotes" TEXT;
