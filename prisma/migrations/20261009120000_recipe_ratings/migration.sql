-- Additiv: thumbs op/ned pr. bruger og ret.
CREATE TABLE "recipe_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recipe_ratings_userId_recipeId_key" ON "recipe_ratings"("userId", "recipeId");
CREATE INDEX "recipe_ratings_recipeId_idx" ON "recipe_ratings"("recipeId");

ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
