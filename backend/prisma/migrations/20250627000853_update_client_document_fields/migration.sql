/*
  Warnings:

  - You are about to drop the column `document` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Client" DROP COLUMN "document",
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT NOT NULL DEFAULT 'DNI';
