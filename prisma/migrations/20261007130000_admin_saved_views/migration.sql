-- CreateTable
CREATE TABLE "admin_saved_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_saved_views_userId_scope_idx" ON "admin_saved_views"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "admin_saved_views_userId_scope_name_key" ON "admin_saved_views"("userId", "scope", "name");
