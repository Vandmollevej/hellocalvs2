import { prisma } from "@/lib/prisma";
import { productImageForViewer } from "@/lib/product-display-image";
import { hasEstimatedMacros } from "@/lib/nutrients";

// "Se dine indscanninger" (bruger 2026-10-02): de varer, brugeren selv har
// oprettet ved at fotografere en stregkode (Product.createdByUserId + mindst
// én stregkode), nyeste først. `added` er sand, når varen er registreret på
// den, der scannede, eller på den aktive familieprofil — forsiden viser kun
// linket, når der er indscanninger fra i dag, der endnu ikke er tilføjet.
// "I dag" afgøres i telefonens tidszone, så klienten filtrerer på createdAt.

const SCAN_HISTORY_DAYS = 90;
const SCAN_HISTORY_LIMIT = 200;

export type UserScan = {
  id: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
  kcalPer100g: number;
  macrosEstimated: boolean;
  createdAt: string;
  added: boolean;
};

export async function listUserScans(scannerId: string, profileId: string): Promise<UserScan[]> {
  const since = new Date(Date.now() - SCAN_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const products = await prisma.product.findMany({
    where: { createdByUserId: scannerId, createdAt: { gte: since }, barcodes: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: SCAN_HISTORY_LIMIT,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      pendingImageUrl: true,
      createdByUserId: true,
      kcalPer100g: true,
      nutrientSources: true,
      createdAt: true,
      brand: { select: { name: true } },
      registrations: {
        where: { userId: { in: [scannerId, profileId] } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: productImageForViewer(product, scannerId),
    brand: product.brand?.name ?? null,
    kcalPer100g: product.kcalPer100g,
    macrosEstimated: hasEstimatedMacros(product.nutrientSources),
    createdAt: product.createdAt.toISOString(),
    added: product.registrations.length > 0,
  }));
}
