-- Rå/tilberedt på generiske ingredienser (docs/REGLER.md, 2026-10-08).
CREATE TYPE "GenericIngredientCookingState" AS ENUM ('RAW', 'COOKED');
ALTER TABLE "generic_ingredients" ADD COLUMN "cookingState" "GenericIngredientCookingState" NOT NULL DEFAULT 'RAW';
