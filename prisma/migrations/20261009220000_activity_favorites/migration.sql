-- Favoritaktiviteter (2026-10-09)
CREATE TABLE IF NOT EXISTS "activity_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_favorites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "activity_favorites_userId_activityKey_key" ON "activity_favorites"("userId", "activityKey");
ALTER TABLE "activity_favorites" ADD CONSTRAINT "activity_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
