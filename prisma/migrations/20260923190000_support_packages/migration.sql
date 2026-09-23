-- Supportpakker forseglet til Supports offentlige nøgle (docs/PRIVACY.md).

-- CreateTable
CREATE TABLE "support_keys" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_packages" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "epk" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_packages_grantId_key" ON "support_packages"("grantId");

-- AddForeignKey
ALTER TABLE "support_packages" ADD CONSTRAINT "support_packages_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "support_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

