-- CreateTable
CREATE TABLE "product_back_photos" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "userId" TEXT,
    "flowId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_back_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_back_photos_analyzedAt_createdAt_idx" ON "product_back_photos"("analyzedAt", "createdAt");

-- CreateIndex
CREATE INDEX "product_back_photos_flowId_idx" ON "product_back_photos"("flowId");

-- CreateIndex
CREATE INDEX "product_back_photos_productId_idx" ON "product_back_photos"("productId");

-- AddForeignKey
ALTER TABLE "product_back_photos" ADD CONSTRAINT "product_back_photos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

