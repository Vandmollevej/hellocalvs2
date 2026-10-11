ALTER TABLE "products" ADD COLUMN "scannedCountry" TEXT, ADD COLUMN "scannedLanguage" TEXT, ADD COLUMN "scannedDeviceLocale" TEXT;
ALTER TABLE "scan_submissions" ADD COLUMN "scannedCountry" TEXT, ADD COLUMN "scannedLanguage" TEXT, ADD COLUMN "scannedDeviceLocale" TEXT;
-- Alt scannet indtil nu er scannet på dansk i Danmark.
UPDATE "scan_submissions" SET "scannedCountry" = 'DK', "scannedLanguage" = 'da', "scannedDeviceLocale" = 'da-DK';
UPDATE "products" SET "scannedCountry" = 'DK', "scannedLanguage" = 'da', "scannedDeviceLocale" = 'da-DK'
WHERE "id" IN (SELECT "productId" FROM "scan_submissions");
