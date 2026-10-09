-- CreateTable
CREATE TABLE "activity_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_favorites_userId_sportKey_key" ON "activity_favorites"("userId", "sportKey");

-- AddForeignKey
ALTER TABLE "activity_favorites" ADD CONSTRAINT "activity_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
