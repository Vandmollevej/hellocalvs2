-- "Slet" på Dine indscanninger skjuler varen fra listen, indtil den scannes igen.
ALTER TABLE "product_scans" ADD COLUMN "hiddenAt" TIMESTAMP(3);
