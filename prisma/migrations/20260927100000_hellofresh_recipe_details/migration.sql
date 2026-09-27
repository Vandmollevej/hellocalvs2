-- HelloFresh-opskriftsvisning (docs/DECISIONS.md 2026-09-27).
ALTER TABLE "products" ADD COLUMN "recipeDetails" JSONB;

CREATE TABLE "recipe_cookbook_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_cookbook_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipe_cookbook_photos_userId_productId_idx" ON "recipe_cookbook_photos"("userId", "productId");

ALTER TABLE "recipe_cookbook_photos" ADD CONSTRAINT "recipe_cookbook_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_cookbook_photos" ADD CONSTRAINT "recipe_cookbook_photos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
