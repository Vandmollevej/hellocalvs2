-- Kropsmål (waist/hip/chest/thigh/upper arm circumference, cm) alongside
-- WeightEntry, backing the photo-diary "Aktuelle mål"/"Seneste mål" caption
-- (docs/STATUS.md 2026-09-12). The dedicated entry page for these values is
-- separate, later work — this migration only adds the storage.
-- Hand-written, same reason as other recent migrations in this project — no
-- local PostgreSQL reachable from this workstation to run `prisma migrate dev`.

-- CreateTable
CREATE TABLE "body_measurements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "upperArmCm" DOUBLE PRECISION,
    "note" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "body_measurements_userId_measuredAt_idx" ON "body_measurements"("userId", "measuredAt");

-- AddForeignKey
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
