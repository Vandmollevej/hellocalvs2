CREATE TABLE "recipe_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeKey" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_ratings_userId_recipeKey_key" ON "recipe_ratings"("userId", "recipeKey");

ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
