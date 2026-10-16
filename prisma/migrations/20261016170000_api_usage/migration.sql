-- Admin → API-forbrug: kald pr. tjeneste pr. måned, budgetter og varsler (docs/DECISIONS.md 2026-10-16).
CREATE TABLE "api_usage_months" (
    "serviceId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "lastOkAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    CONSTRAINT "api_usage_months_pkey" PRIMARY KEY ("serviceId","month")
);

CREATE TABLE "api_budgets" (
    "serviceId" TEXT NOT NULL,
    "monthlyBudget" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "api_budgets_pkey" PRIMARY KEY ("serviceId")
);

CREATE TABLE "api_alert_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sent" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_alert_settings_pkey" PRIMARY KEY ("id")
);
