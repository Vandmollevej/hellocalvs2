CREATE TABLE "recipe_source_urls" (
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isRecipe" BOOLEAN NOT NULL DEFAULT false,
    "lastmod" TEXT,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_source_urls_pkey" PRIMARY KEY ("url")
);

CREATE INDEX "recipe_source_urls_source_isRecipe_idx" ON "recipe_source_urls"("source", "isRecipe");
