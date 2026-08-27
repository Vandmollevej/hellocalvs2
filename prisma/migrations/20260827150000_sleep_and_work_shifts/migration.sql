-- AlterTable
ALTER TABLE "users" ADD COLUMN "defaultBedtime" TEXT;
ALTER TABLE "users" ADD COLUMN "defaultWakeTime" TEXT;
ALTER TABLE "users" ADD COLUMN "shiftWorkEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sleep_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "bedtime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,

    CONSTRAINT "sleep_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "bedtime" TEXT,
    "wakeTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sleep_schedules_userId_weekday_key" ON "sleep_schedules"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "work_shifts_userId_date_key" ON "work_shifts"("userId", "date");

-- AddForeignKey
ALTER TABLE "sleep_schedules" ADD CONSTRAINT "sleep_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_shifts" ADD CONSTRAINT "work_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
