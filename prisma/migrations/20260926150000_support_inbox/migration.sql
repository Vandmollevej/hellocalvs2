-- Support-indbakke: tråde, prioritet og 24-timers-advarsel (docs/DECISIONS.md 2026-09-26).
ALTER TYPE "MessageEvent" ADD VALUE 'SUPPORT_REPLY';
ALTER TYPE "MessageEvent" ADD VALUE 'SUPPORT_OVERDUE_ADMIN';

CREATE TYPE "SupportPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');
CREATE TYPE "SupportMessageAuthor" AS ENUM ('USER', 'SUPPORT', 'NOTE');

ALTER TABLE "support_requests"
    ADD COLUMN "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN "awaitingReply" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "lastUserMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "lastSupportReplyAt" TIMESTAMP(3),
    ADD COLUMN "overdueAlertSentAt" TIMESTAMP(3),
    ADD COLUMN "userUnread" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Eksisterende sager: tidspunkter fra oprettelsen. Løste sager venter ikke på
-- svar, og gamle åbne sager skal ikke udløse en stribe advarsler ved deploy.
UPDATE "support_requests"
SET "lastUserMessageAt" = "createdAt",
    "updatedAt" = COALESCE("resolvedAt", "createdAt"),
    "awaitingReply" = ("status" = 'OPEN'),
    "overdueAlertSentAt" = CASE WHEN "status" = 'OPEN' THEN CURRENT_TIMESTAMP ELSE NULL END;

CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "author" "SupportMessageAuthor" NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_messages_requestId_createdAt_idx" ON "support_messages"("requestId", "createdAt");
CREATE INDEX "support_requests_status_awaitingReply_lastUserMessageAt_idx" ON "support_requests"("status", "awaitingReply", "lastUserMessageAt");

ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Den oprindelige besked bliver første besked i tråden.
INSERT INTO "support_messages" ("id", "requestId", "author", "body", "createdAt")
SELECT 'first_' || "id", "id", 'USER', "message", "createdAt" FROM "support_requests";
