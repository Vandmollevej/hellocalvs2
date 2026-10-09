-- CreateTable
CREATE TABLE "product_energy_split_flags" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviationPoints" DOUBLE PRECISION NOT NULL,
    "split" JSONB NOT NULL,
    "referenceSplit" JSONB NOT NULL,
    "groupSize" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "product_energy_split_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_energy_split_flags_productId_key" ON "product_energy_split_flags"("productId");

-- CreateIndex
CREATE INDEX "product_energy_split_flags_reviewedAt_idx" ON "product_energy_split_flags"("reviewedAt");

-- AddForeignKey
ALTER TABLE "product_energy_split_flags" ADD CONSTRAINT "product_energy_split_flags_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
