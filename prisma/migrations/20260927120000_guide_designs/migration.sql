-- Admin guide-builder: startup-guide og tooltips (docs/DECISIONS.md 2026-09-27).

-- CreateTable
CREATE TABLE "guide_designs" (
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_designs_pkey" PRIMARY KEY ("kind")
);
