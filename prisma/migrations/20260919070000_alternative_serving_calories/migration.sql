-- AlterTable
ALTER TABLE "products" ADD COLUMN "alternativeServings" JSONB;

-- CreateEnum
CREATE TYPE "BugReportSource" AS ENUM ('USER', 'AI');

-- AlterTable: BugReport.userId becomes optional (AI-filed reports, see
-- BugReportSource above, have no submitting user).
ALTER TABLE "bug_reports" DROP CONSTRAINT "bug_reports_userId_fkey";
ALTER TABLE "bug_reports" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "bug_reports" ADD COLUMN "source" "BugReportSource" NOT NULL DEFAULT 'USER';
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
