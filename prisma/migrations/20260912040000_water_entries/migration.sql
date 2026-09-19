-- Manual water intake logging (docs/STATUS.md roadmap note, 2026-09-12: a
-- dedicated FAB action for "VAND"). Hand-written, same reason as other
-- recent migrations in this project — no local PostgreSQL reachable from
-- this workstation to run `prisma migrate dev`.

-- CreateTable
CREATE TABLE "water_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMl" DOUBLE PRECISION NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "water_entries_userId_loggedAt_idx" ON "water_entries"("userId", "loggedAt");

-- AddForeignKey
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
