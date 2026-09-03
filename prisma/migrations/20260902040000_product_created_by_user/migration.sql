-- AlterTable
ALTER TABLE "products" ADD COLUMN "createdByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
