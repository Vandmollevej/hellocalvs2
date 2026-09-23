-- Anonym statistik uden identifikatorer (docs/PRIVACY.md).

-- CreateTable
CREATE TABLE "analytics_buckets" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "country" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "sum" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_usage_daily" (
    "day" DATE NOT NULL,
    "productId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_usage_daily_pkey" PRIMARY KEY ("day","productId")
);

-- CreateIndex
CREATE INDEX "analytics_buckets_metric_day_idx" ON "analytics_buckets"("metric", "day");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_buckets_day_country_ageBand_sex_metric_bucket_key" ON "analytics_buckets"("day", "country", "ageBand", "sex", "metric", "bucket");

-- CreateIndex
CREATE INDEX "product_usage_daily_productId_day_idx" ON "product_usage_daily"("productId", "day");

