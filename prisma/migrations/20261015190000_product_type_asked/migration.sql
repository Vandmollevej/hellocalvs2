-- Varer uden varenavn (docs/DECISIONS.md 2026-10-15): hvornår OpenAI er spurgt,
-- hvilken produkttype brand + subbrand + variant er (src/lib/product-type-name.ts).
ALTER TABLE "products" ADD COLUMN "productTypeAskedAt" TIMESTAMP(3);
