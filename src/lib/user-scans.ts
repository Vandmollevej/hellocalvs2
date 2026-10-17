import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { productImageForViewer } from "@/lib/product-display-image";
import { hasEstimatedMacros } from "@/lib/nutrients";

// "Se dine indscanninger" (bruger 2026-10-02): de varer, brugeren selv har
// oprettet ved at fotografere en stregkode (Product.createdByUserId + mindst
// én stregkode), nyeste først. `added` er sand, når varen er registreret på
// den, der scannede, eller på den aktive familieprofil — forsiden viser kun
// linket, når der er indscanninger fra i dag, der endnu ikke er tilføjet.
// "I dag" afgøres i telefonens tidszone, så klienten filtrerer på createdAt.
//
// Bruger 2026-10-17: en kendt vare, brugeren scanner (fx en cola fra Open Food
// Facts), skal også stå på listen. Opslaget af stregkoden gemmer derfor en
// ProductScan, og listen samler egne oprettede varer og scannede varer.
// createdAt er så tidspunktet for den seneste scanning.

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

// Gemmer, at brugeren har scannet en kendt vare (én række pr. bruger og vare,
// tidspunktet flyttes frem). Fejl må aldrig stoppe selve opslaget.
export async function recordProductScanSafely(userId: string, productId: string) {
  const scannedAt = new Date();
  await prisma.productScan
    .upsert({
      where: { userId_productId: { userId, productId } },
      update: { scannedAt },
      create: { userId, productId, scannedAt },
    })
    .catch((error) => console.error("Could not record product scan", error));
}

const scanProductSelect = (scannerId: string, profileId: string) =>
  ({
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
  }) satisfies Prisma.ProductSelect;

export async function listUserScans(scannerId: string, profileId: string): Promise<UserScan[]> {
  const since = new Date(Date.now() - SCAN_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const select = scanProductSelect(scannerId, profileId);
  const [created, scanned] = await Promise.all([
    prisma.product.findMany({
      where: { createdByUserId: scannerId, createdAt: { gte: since }, barcodes: { some: {} } },
      orderBy: { createdAt: "desc" },
      take: SCAN_HISTORY_LIMIT,
      select,
    }),
    prisma.productScan.findMany({
      where: { userId: scannerId, scannedAt: { gte: since } },
      orderBy: { scannedAt: "desc" },
      take: SCAN_HISTORY_LIMIT,
      select: { scannedAt: true, product: { select } },
    }),
  ]);

  // Samme vare kan være både oprettet og scannet: seneste tidspunkt vinder.
  type Row = { product: (typeof created)[number]; at: Date };
  const byId = new Map<string, Row>();
  for (const row of [
    ...created.map((product) => ({ product, at: product.createdAt })),
    ...scanned.map((scan) => ({ product: scan.product, at: scan.scannedAt })),
  ]) {
    const current = byId.get(row.product.id);
    if (!current || row.at > current.at) byId.set(row.product.id, row);
  }

  return [...byId.values()]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, SCAN_HISTORY_LIMIT)
    .map(({ product, at }) => ({
      id: product.id,
      name: product.name,
      imageUrl: productImageForViewer(product, scannerId),
      brand: product.brand?.name ?? null,
      kcalPer100g: product.kcalPer100g,
      macrosEstimated: hasEstimatedMacros(product.nutrientSources),
      createdAt: at.toISOString(),
      added: product.registrations.length > 0,
    }));
}
