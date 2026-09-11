-- Adds optional extra-nutrition snapshot columns to "registrations", so real
-- sugar/fiber/salt/potassium/calcium/iron data (currently only available on
-- HelloFresh-recipe products via Product.nutritionExtra, see
-- docs/DECISIONS.md 2026-08-29) can be captured at registration time and
-- averaged into the previously-empty "Kulhydrattyper og fibre"/"Mineraler"
-- stat-card categories. All nullable: most registrations have no source for
-- these values.
ALTER TABLE "registrations"
  ADD COLUMN "sugarSnapshot" DOUBLE PRECISION,
  ADD COLUMN "fiberSnapshot" DOUBLE PRECISION,
  ADD COLUMN "saltSnapshot" DOUBLE PRECISION,
  ADD COLUMN "potassiumSnapshot" DOUBLE PRECISION,
  ADD COLUMN "calciumSnapshot" DOUBLE PRECISION,
  ADD COLUMN "ironSnapshot" DOUBLE PRECISION;
