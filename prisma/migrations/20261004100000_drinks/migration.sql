-- CreateTable
CREATE TABLE "drinks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drink_ingredients" (
    "id" TEXT NOT NULL,
    "drinkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'cl',
    "defaultAmount" DOUBLE PRECISION NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "step" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "kcalPer100ml" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proteinPer100ml" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbsPer100ml" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatPer100ml" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugarPer100ml" DOUBLE PRECISION,
    "alcoholPercent" DOUBLE PRECISION,

    CONSTRAINT "drink_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drink_ingredients_drinkId_sortOrder_idx" ON "drink_ingredients"("drinkId", "sortOrder");

-- AddForeignKey
ALTER TABLE "drink_ingredients" ADD CONSTRAINT "drink_ingredients_drinkId_fkey" FOREIGN KEY ("drinkId") REFERENCES "drinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
