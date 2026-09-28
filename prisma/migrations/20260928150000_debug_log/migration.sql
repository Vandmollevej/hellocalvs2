-- CreateTable
CREATE TABLE "debug_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "flowId" TEXT,
    "userId" TEXT,
    "barcode" TEXT,
    "productId" TEXT,
    "durationMs" INTEGER,
    "message" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debug_log_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debug_log_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debug_logs_createdAt_idx" ON "debug_logs"("createdAt");

-- CreateIndex
CREATE INDEX "debug_logs_category_createdAt_idx" ON "debug_logs"("category", "createdAt");

-- CreateIndex
CREATE INDEX "debug_logs_flowId_idx" ON "debug_logs"("flowId");
