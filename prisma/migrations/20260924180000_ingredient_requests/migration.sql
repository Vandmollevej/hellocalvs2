-- 2026-09-24: "Opret egen ingrediens" — anonyme anmodninger til admin (docs/DECISIONS.md).
ALTER TYPE "MessageEvent" ADD VALUE IF NOT EXISTS 'INGREDIENT_REQUEST_ADMIN';

CREATE TYPE "IngredientRequestStatus" AS ENUM ('PENDING', 'ADDED', 'REJECTED');

CREATE TABLE "ingredient_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "replyInboxId" TEXT,
    "status" "IngredientRequestStatus" NOT NULL DEFAULT 'PENDING',
    "genericIngredientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ingredient_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ingredient_requests_status_createdAt_idx" ON "ingredient_requests"("status", "createdAt");

ALTER TABLE "ingredient_requests" ADD CONSTRAINT "ingredient_requests_genericIngredientId_fkey" FOREIGN KEY ("genericIngredientId") REFERENCES "generic_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
