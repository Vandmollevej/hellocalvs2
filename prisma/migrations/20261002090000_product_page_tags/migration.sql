-- Nøgleord på produktsiden (docs/DECISIONS.md 2026-10-02).
CREATE TABLE "product_page_tag_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_page_tag_settings_pkey" PRIMARY KEY ("id")
);
