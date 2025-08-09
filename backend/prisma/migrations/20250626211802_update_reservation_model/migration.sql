-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "fixed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservationType" TEXT NOT NULL DEFAULT 'con_desayuno';
