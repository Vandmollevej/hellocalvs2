-- API-nøgler rettet fra admin (docs/DECISIONS.md 2026-09-25 "API-nøgler i admin").
-- CreateTable
CREATE TABLE "app_secrets" (
    "key" TEXT NOT NULL,
    "cipherText" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_secrets_pkey" PRIMARY KEY ("key")
);
