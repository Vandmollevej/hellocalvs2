-- Oplevelse af søvn (docs/DECISIONS.md 2026-09-26).
ALTER TABLE "users" ADD COLUMN "sleepQualityPromptEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "sleep_quality_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleep_quality_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sleep_quality_entries_userId_date_key" ON "sleep_quality_entries"("userId", "date");

ALTER TABLE "sleep_quality_entries" ADD CONSTRAINT "sleep_quality_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
