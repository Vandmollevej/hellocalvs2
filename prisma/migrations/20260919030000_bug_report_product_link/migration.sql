-- AlterEnum
ALTER TYPE "MessageEvent" ADD VALUE 'BUG_REPORT_REJECTED';

-- AlterTable
ALTER TABLE "bug_reports" ADD COLUMN "productId" TEXT;

-- CreateIndex
CREATE INDEX "bug_reports_userId_productId_idx" ON "bug_reports"("userId", "productId");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
