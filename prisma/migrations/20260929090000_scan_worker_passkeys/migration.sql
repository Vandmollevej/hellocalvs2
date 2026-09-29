-- CreateTable
CREATE TABLE "scan_worker_passkeys" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "scan_worker_passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_worker_passkeys_credentialId_key" ON "scan_worker_passkeys"("credentialId");

-- CreateIndex
CREATE INDEX "scan_worker_passkeys_workerId_idx" ON "scan_worker_passkeys"("workerId");

-- AddForeignKey
ALTER TABLE "scan_worker_passkeys" ADD CONSTRAINT "scan_worker_passkeys_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "scan_workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
