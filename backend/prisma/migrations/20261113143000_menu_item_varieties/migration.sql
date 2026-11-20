-- CreateTable
CREATE TABLE "MenuItemVariety" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "ordenIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemVariety_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItemVariety_menuItemId_idx" ON "MenuItemVariety"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemVariety_menuItemId_name_key" ON "MenuItemVariety"("menuItemId", "name");

-- AddForeignKey
ALTER TABLE "MenuItemVariety" ADD CONSTRAINT "MenuItemVariety_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
