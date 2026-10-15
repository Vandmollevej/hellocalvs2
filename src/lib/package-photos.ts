import { prisma } from "@/lib/prisma";

// Skjulte helbilleder af hele varen (PACKAGE-analyser, POST
// /api/ai/save-package-photo, docs/DECISIONS.md 2026-10-15) kobles til varen.
// Fotos sendt med id'et kobles direkte; et foto, hvis upload ikke nåede at
// svare før oprettelsen, findes på stregkoden (uden vare, fra de sidste timer).
// Kommer der nye fotos til, scannes varen for mærkater igen om natten.

const ORPHAN_WINDOW_MS = 6 * 60 * 60 * 1000;

export function cleanPackageAnalysisIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && /^[a-z0-9]{10,40}$/i.test(id)).slice(0, 10);
}

export async function linkPackagePhotos(productId: string, ids: string[], barcode: string | null): Promise<number> {
  const or = [
    ...(ids.length ? [{ id: { in: ids } }] : []),
    ...(barcode ? [{ barcode, createdAt: { gte: new Date(Date.now() - ORPHAN_WINDOW_MS) } }] : []),
  ];
  if (!or.length) return 0;
  const linked = await prisma.aiProductAnalysis.updateMany({
    where: { kind: "PACKAGE", productId: null, OR: or },
    data: { productId },
  });
  if (linked.count) await prisma.product.update({ where: { id: productId }, data: { labelsScannedAt: null } });
  return linked.count;
}
