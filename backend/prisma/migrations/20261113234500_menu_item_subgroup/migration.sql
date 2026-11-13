-- AlterTable: subgrupo dentro de BEBIDAS / MINUTAS / CAFETERIA (Excel: Ensaladas, Licuados, …)
ALTER TABLE "MenuItem" ADD COLUMN "subgroup" TEXT;

-- CreateIndex
CREATE INDEX "MenuItem_category_subgroup_idx" ON "MenuItem"("category", "subgroup");
