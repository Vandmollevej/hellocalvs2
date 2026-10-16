-- Lokal mærkesøgning pr. foto (docs/DECISIONS.md 2026-10-15): intern AI først,
-- OpenAI kun når intet blev fundet lokalt.
CREATE TABLE "label_photo_scans" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "labels" JSONB NOT NULL DEFAULT '[]',
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "label_photo_scans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "label_photo_scans_product_id_url_key" ON "label_photo_scans"("product_id", "url");

ALTER TABLE "label_photo_scans" ADD CONSTRAINT "label_photo_scans_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
