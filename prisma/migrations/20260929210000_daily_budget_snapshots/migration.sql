-- Dagligt kaloriebudget pr. dato, kun fremadrettet (docs/ACTIVITY-PAL.md).
CREATE TABLE "daily_budget_snapshots" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "budgetKcal" INTEGER NOT NULL,
  "needKcal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_budget_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_budget_snapshots_userId_date_key" ON "daily_budget_snapshots"("userId", "date");

ALTER TABLE "daily_budget_snapshots"
  ADD CONSTRAINT "daily_budget_snapshots_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
