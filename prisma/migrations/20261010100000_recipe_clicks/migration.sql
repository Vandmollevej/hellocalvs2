CREATE TABLE "recipe_clicks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_clicks_createdAt_recipeKey_idx" ON "recipe_clicks"("createdAt", "recipeKey");

CREATE INDEX "recipe_clicks_userId_recipeKey_createdAt_idx" ON "recipe_clicks"("userId", "recipeKey", "createdAt");

ALTER TABLE "recipe_clicks" ADD CONSTRAINT "recipe_clicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
