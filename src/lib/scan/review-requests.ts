import { prisma } from "@/lib/prisma";
import { reassessOffProduct } from "@/lib/off-quality-job";
import { OFF_QUALITY_CATEGORY_LABELS, type OffQualityCategory } from "@/lib/off-quality";
import { FRONT_CROPPED_CATEGORY, FRONT_CROPPED_LABEL } from "@/lib/front-image-check";

// "Send til scan-appen" (docs/DECISIONS.md 2026-10-11): admin sender
// Open Food Facts-varer, der ikke lever op til kvaliteten, til Oprettelses-
// appen. Varen står så som "ikke scannet" på hyldeoverlayet og i listen
// "Skal scannes", til en agent har oprettet/suppleret den (scanDoneAt).

export type ScanRequestItem = {
  productId: string;
  name: string;
  brand: string | null;
  packageSizeText: string | null;
  barcode: string | null;
  imageUrl: string | null;
  requestedAt: Date;
  categories: { key: string; label: string }[];
  comments: string[];
};

function commentsOf(findings: unknown): string[] {
  if (!Array.isArray(findings)) return [];
  return findings
    .map((f) => (f && typeof (f as { comment?: unknown }).comment === "string" ? (f as { comment: string }).comment : ""))
    .filter(Boolean);
}

// Åbne forespørgsler, ældste først (nyeste nederst, så listen ikke hopper).
export async function listOpenScanRequests(take = 300): Promise<ScanRequestItem[]> {
  const rows = await prisma.productQualityReview.findMany({
    where: {
      scanRequestedAt: { not: null },
      scanDoneAt: null,
      product: { discontinued: false, status: { not: "REJECTED" } },
    },
    orderBy: { scanRequestedAt: "asc" },
    take,
    select: {
      productId: true,
      scanRequestedAt: true,
      categories: true,
      findings: true,
      product: {
        select: {
          name: true,
          imageUrl: true,
          packageSizeText: true,
          brand: { select: { name: true } },
          barcodes: { select: { code: true }, take: 1 },
        },
      },
    },
  });
  return rows.map((row) => ({
    productId: row.productId,
    name: row.product.name,
    brand: row.product.brand?.name ?? null,
    packageSizeText: row.product.packageSizeText,
    barcode: row.product.barcodes[0]?.code ?? null,
    imageUrl: row.product.imageUrl,
    requestedAt: row.scanRequestedAt as Date,
    categories: row.categories.map((key) => ({
      key,
      label: key === FRONT_CROPPED_CATEGORY ? FRONT_CROPPED_LABEL : (OFF_QUALITY_CATEGORY_LABELS[key as OffQualityCategory] ?? key),
    })),
    comments: commentsOf(row.findings),
  }));
}

// En agent har oprettet/suppleret varen: forespørgslen er klaret, og varen
// vurderes igen, så admin-listen viser de nye tal.
export async function completeScanRequest(productId: string, workerId: string): Promise<boolean> {
  const done = await prisma.productQualityReview.updateMany({
    where: { productId, scanRequestedAt: { not: null }, scanDoneAt: null },
    data: { scanDoneAt: new Date(), scanDoneByWorkerId: workerId },
  });
  await reassessOffProduct(productId).catch((error) => console.error("Open Food Facts-vurdering efter scanning fejlede", error));
  return done.count > 0;
}
