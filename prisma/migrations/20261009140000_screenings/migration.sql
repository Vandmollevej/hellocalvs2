-- Screeninger (docs/DECISIONS.md 2026-10-09). Hand-written like the other recent migrations.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "screeningsSeeded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "screenings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presetKey" TEXT,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "questions" JSONB NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notificationTime" TEXT,
    "scale" TEXT NOT NULL DEFAULT 'TEN',
    "inputType" TEXT NOT NULL DEFAULT 'SLIDER',
    "notesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minLabel" TEXT NOT NULL DEFAULT '',
    "maxLabel" TEXT NOT NULL DEFAULT '',
    "showInCalendar" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_entries" (
    "id" TEXT NOT NULL,
    "screeningId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "answers" JSONB NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screenings_userId_idx" ON "screenings"("userId");
CREATE UNIQUE INDEX "screening_entries_screeningId_date_key" ON "screening_entries"("screeningId", "date");
CREATE INDEX "screening_entries_userId_date_idx" ON "screening_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "screenings" ADD CONSTRAINT "screenings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "screening_entries" ADD CONSTRAINT "screening_entries_screeningId_fkey" FOREIGN KEY ("screeningId") REFERENCES "screenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "screening_entries" ADD CONSTRAINT "screening_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
