-- CreateTable
CREATE TABLE "RoomStatusPeriod" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomStatusPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomStatusPeriod_roomId_startDate_endDate_idx" ON "RoomStatusPeriod"("roomId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "RoomStatusPeriod_startDate_endDate_idx" ON "RoomStatusPeriod"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "RoomStatusPeriod" ADD CONSTRAINT "RoomStatusPeriod_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
