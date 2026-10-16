-- Varer uden varenavn (docs/DECISIONS.md 2026-10-15): hvornår OpenAI er spurgt,
-- hvilken produkttype brand + subbrand + variant er (src/lib/product-type-name.ts).
ALTER TABLE "products" ADD COLUMN "productTypeAskedAt" TIMESTAMP(3);

-- Scannede varer med 0 kcal: hvornår det er tjekket, om de er en alkoholisk
-- drik, hvis næring kan skønnes (src/lib/alcohol-nutrition.ts).
ALTER TABLE "products" ADD COLUMN "alcoholCheckedAt" TIMESTAMP(3);
