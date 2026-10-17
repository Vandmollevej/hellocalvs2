CREATE TABLE "product_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_scans_userId_productId_key" ON "product_scans"("userId", "productId");
CREATE INDEX "product_scans_userId_scannedAt_idx" ON "product_scans"("userId", "scannedAt");

ALTER TABLE "product_scans" ADD CONSTRAINT "product_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_scans" ADD CONSTRAINT "product_scans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
