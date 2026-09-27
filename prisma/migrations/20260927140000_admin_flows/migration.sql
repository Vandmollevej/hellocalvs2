-- Admin: egne flow-sider under "Flows" (docs/DECISIONS.md 2026-09-27).

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_pages" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "buttonLabel" TEXT NOT NULL DEFAULT 'Næste',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_pages_flowId_sortOrder_idx" ON "flow_pages"("flowId", "sortOrder");

-- AddForeignKey
ALTER TABLE "flow_pages" ADD CONSTRAINT "flow_pages_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
