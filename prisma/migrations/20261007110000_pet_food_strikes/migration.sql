-- AlterTable
ALTER TABLE "users" ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "blockedReason" TEXT,
ADD COLUMN "petFoodStrikesResetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pet_food_incidents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "barcode" TEXT,
    "productId" TEXT,
    "matchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_food_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_food_incidents_userId_createdAt_idx" ON "pet_food_incidents"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "pet_food_incidents_createdAt_idx" ON "pet_food_incidents"("createdAt");

-- AddForeignKey
ALTER TABLE "pet_food_incidents" ADD CONSTRAINT "pet_food_incidents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;