-- CreateTable
CREATE TABLE "bug_report_notes" (
    "id" TEXT NOT NULL,
    "bugReportId" TEXT NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_report_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_report_notes_bugReportId_createdAt_idx" ON "bug_report_notes"("bugReportId", "createdAt");

-- AddForeignKey
ALTER TABLE "bug_report_notes" ADD CONSTRAINT "bug_report_notes_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_report_notes" ADD CONSTRAINT "bug_report_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
