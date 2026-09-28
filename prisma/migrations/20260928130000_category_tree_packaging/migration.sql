-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "packaging" TEXT;

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
