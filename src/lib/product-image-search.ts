import { copyFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

// Originale produktbilleder fundet online (Google Vision, logo-agent
// product_images.py, docs/DECISIONS.md 2026-10-15). Admin vælger et fund under
// Billedforslag: et fritlagt fund bliver varens billede med det samme; et fund
// med baggrund fritlægges først af image-agent og kommer tilbage som forslag.

const PUBLIC_DIR = path.join(process.cwd(), "public");
const CHOSEN_DIR = path.join(PUBLIC_DIR, "product-images", "web-chosen");
const CANDIDATE_PREFIX = "/product-images/web-candidates/";

export async function chooseWebCandidate(productId: string, candidateId: string): Promise<{ ok: boolean; message?: string; cutout?: boolean }> {
  const candidate = await prisma.productImageCandidate.findUnique({
    where: { id: candidateId },
    select: { imageUrl: true, transparent: true, search: { select: { id: true, productId: true } } },
  });
  if (!candidate || candidate.search.productId !== productId) return { ok: false, message: "Fundet findes ikke" };
  if (!candidate.imageUrl.startsWith(CANDIDATE_PREFIX)) return { ok: false, message: "Ugyldigt billede" };

  // Kandidaterne slettes efter 7 dage, så det valgte billede kopieres ud.
  const source = path.join(PUBLIC_DIR, path.normalize(candidate.imageUrl).replace(/^([/\\])+/, ""));
  if (!source.startsWith(path.join(PUBLIC_DIR, "product-images"))) return { ok: false, message: "Ugyldigt billede" };
  await mkdir(CHOSEN_DIR, { recursive: true });
  const filename = `${productId}-${Date.now()}.png`;
  await copyFile(source, path.join(CHOSEN_DIR, filename));
  const url = `/product-images/web-chosen/${filename}`;

  await prisma.$transaction(async (tx) => {
    if (candidate.transparent) {
      await tx.product.update({ where: { id: productId }, data: { imageUrl: url, pendingImageUrl: null, imageStatus: "APPROVED" } });
    } else {
      // Fritlægges af image-agent (søgningen online er allerede gjort).
      await tx.product.update({ where: { id: productId }, data: { pendingImageUrl: null } });
      await tx.imageCutoutJob.create({ data: { kind: "PRODUCT_FRONT", sourceUrl: url, productId, webSearchedAt: new Date() } });
    }
    await tx.productImageSearch.update({
      where: { id: candidate.search.id },
      data: { status: "CHOSEN", chosenCandidateId: candidateId, resolvedAt: new Date() },
    });
  });
  return { ok: true, cutout: !candidate.transparent };
}

// Admin godkendte udklippet eller afviste: åbne søgninger lukkes uden valg.
export async function resolveOpenSearches(productId: string) {
  await prisma.productImageSearch.updateMany({
    where: { productId, status: "PENDING_REVIEW" },
    data: { status: "REJECTED", resolvedAt: new Date() },
  });
}
