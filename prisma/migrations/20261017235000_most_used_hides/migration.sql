-- "Slet" på Madvarer → Mest brugte: skjult, indtil varen registreres igen.
CREATE TABLE "most_used_hides" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "most_used_hides_pkey" PRIMARY KEY ("userId","productId")
);

ALTER TABLE "most_used_hides" ADD CONSTRAINT "most_used_hides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "most_used_hides" ADD CONSTRAINT "most_used_hides_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
