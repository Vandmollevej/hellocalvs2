-- Delte brugeropskrifter uden kobling til bruger eller boks (docs/PRIVACY.md,
-- docs/DECISIONS.md 2026-09-24).

-- CreateEnum
CREATE TYPE "SharedRecipeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "shared_recipes" (
    "id" TEXT NOT NULL,
    "publisherHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'da',
    "ingredients" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "totalGrams" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "status" "SharedRecipeStatus" NOT NULL DEFAULT 'PENDING',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_recipe_publisher_blocks" (
    "publisherHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_recipe_publisher_blocks_pkey" PRIMARY KEY ("publisherHash")
);

-- CreateIndex
CREATE INDEX "shared_recipes_status_createdAt_idx" ON "shared_recipes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shared_recipes_publisherHash_idx" ON "shared_recipes"("publisherHash");
