-- Sukkerpåstande på butiksvarer (docs/DECISIONS.md 2026-10-02): lavt sukkerindhold,
-- uden tilsat sukker, reduceret sukker og light. Samme mønster som øvrige
-- filterkolonner: NULL = nej/ukendt, udfyldt = ja. Kun til søgning/filtre.
ALTER TABLE "product_filters" ADD COLUMN "lowSugar" TEXT;
ALTER TABLE "product_filters" ADD COLUMN "noAddedSugar" TEXT;
ALTER TABLE "product_filters" ADD COLUMN "reducedSugar" TEXT;
ALTER TABLE "product_filters" ADD COLUMN "lightSugar" TEXT;

CREATE INDEX "product_filters_lowSugar_idx" ON "product_filters"("lowSugar");
CREATE INDEX "product_filters_noAddedSugar_idx" ON "product_filters"("noAddedSugar");
CREATE INDEX "product_filters_reducedSugar_idx" ON "product_filters"("reducedSugar");
CREATE INDEX "product_filters_lightSugar_idx" ON "product_filters"("lightSugar");
