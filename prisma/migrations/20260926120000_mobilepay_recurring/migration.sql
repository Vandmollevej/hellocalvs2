-- MobilePay Recurring (docs/DECISIONS.md 2026-09-26)
ALTER TABLE "subscriptions" ADD COLUMN "pendingAgreementId" TEXT;

CREATE TABLE "payment_charges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerAgreementId" TEXT NOT NULL,
    "providerChargeId" TEXT NOT NULL,
    "amountOre" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_charges_providerChargeId_key" ON "payment_charges"("providerChargeId");
CREATE UNIQUE INDEX "payment_charges_providerAgreementId_periodStart_key" ON "payment_charges"("providerAgreementId", "periodStart");
CREATE INDEX "payment_charges_status_idx" ON "payment_charges"("status");

ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_webhooks" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerWebhookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretCipher" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_webhooks_provider_url_key" ON "payment_webhooks"("provider", "url");
