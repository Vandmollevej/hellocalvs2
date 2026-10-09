-- CreateTable
CREATE TABLE "native_auth_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "method" TEXT,
    "codeChallenge" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "native_auth_codes_codeHash_key" ON "native_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "native_auth_codes_userId_idx" ON "native_auth_codes"("userId");

-- CreateIndex
CREATE INDEX "native_auth_codes_expiresAt_idx" ON "native_auth_codes"("expiresAt");
