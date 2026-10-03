-- Hjælpe-chatbot (docs/DECISIONS.md 2026-10-02)
CREATE TYPE "ChatbotCategory" AS ENUM ('GETTING_STARTED', 'FOOD_LOGGING', 'PRODUCTS_SCANNING', 'DISHES', 'GOALS_NUTRITION', 'WEIGHT_STATS', 'ACCOUNT_LOGIN', 'SUBSCRIPTION_PAYMENT', 'PRIVACY_DATA', 'INTEGRATIONS', 'FAMILY', 'BUG', 'OTHER');
CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "ChatbotChannel" AS ENUM ('APP', 'WEB');

CREATE TABLE "chatbot_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ChatbotChannel" NOT NULL DEFAULT 'APP',
    "category" "ChatbotCategory" NOT NULL DEFAULT 'OTHER',
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "userAgeSnapshot" INTEGER,
    "userSexSnapshot" "Sex",
    "userRegionSnapshot" TEXT NOT NULL DEFAULT 'DK',
    "userTierSnapshot" TEXT NOT NULL DEFAULT 'FREE',
    "userPlanSnapshot" "SubscriptionPlan",
    "userLocaleSnapshot" TEXT NOT NULL DEFAULT 'da',
    "escalatedAt" TIMESTAMP(3),
    "supportRequestId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatbotMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "category" "ChatbotCategory",
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chatbot_conversations_userId_lastMessageAt_idx" ON "chatbot_conversations"("userId", "lastMessageAt");
CREATE INDEX "chatbot_conversations_lastMessageAt_idx" ON "chatbot_conversations"("lastMessageAt");
CREATE INDEX "chatbot_conversations_category_idx" ON "chatbot_conversations"("category");
CREATE INDEX "chatbot_messages_conversationId_createdAt_idx" ON "chatbot_messages"("conversationId", "createdAt");
CREATE INDEX "chatbot_messages_role_createdAt_idx" ON "chatbot_messages"("role", "createdAt");
CREATE INDEX "chatbot_messages_category_createdAt_idx" ON "chatbot_messages"("category", "createdAt");

ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_supportRequestId_fkey" FOREIGN KEY ("supportRequestId") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
