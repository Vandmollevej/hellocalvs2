-- AlterTable
ALTER TABLE "products" ADD COLUMN "petFoodTextCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pet_food_incidents" ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'BLOCKED',
ADD COLUMN "productName" TEXT,
ADD COLUMN "countedAsStrike" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "falsePositive" BOOLEAN NOT NULL DEFAULT false;

-- DropForeignKey
ALTER TABLE "pet_food_incidents" DROP CONSTRAINT "pet_food_incidents_userId_fkey";

-- AddForeignKey
ALTER TABLE "pet_food_incidents" ADD CONSTRAINT "pet_food_incidents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "pet_food_incidents_reviewedAt_createdAt_idx" ON "pet_food_incidents"("reviewedAt", "createdAt");