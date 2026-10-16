import { open, stat } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { frontPhotoProblem, imageSize } from "@/lib/front-photo-guard";

// Natlig robot "front-image-check" (docs/DECISIONS.md 2026-10-15): finder
// forsidebilleder, der er beskåret/halveret, og sender varen til scan-appens
// "Skal scannes", så forsiden bliver taget om. To kendetegn:
//   1. Billedet selv: et kamerafoto i qc-uploads (JPEG, ikke fritlagt PNG),
//      der er smallere end 0,45 eller under 240 px (front-photo-guard.ts).
//   2. Loggen: flowet beskar fotoet til AI'ens boks (2026-10-14 → 2026-10-15,
//      `front_objects` med "i rammens midte bruges"), og varen fik sit
//      billede i samme flow — også når billedrobotten senere har fritlagt det.
// Et nyt forsidefoto (scan-appen, genscanning, admin) lukker sagen.

export const FRONT_CROPPED_CATEGORY = "FRONT_CROPPED";
export const FRONT_CROPPED_LABEL = "Beskåret forsidebillede";

const QC_PREFIX = "/product-images/qc-uploads/";
const HEAD_BYTES = 256 * 1024;
// Den gamle beskæring skrev denne tekst i loggen (ProductCaptureFlow før 2026-10-15).
const CROPPED_LOG_TEXT = "i rammens midte bruges";
// Fotoet gemmes ved oprettelsen, få minutter efter forsidetrinnet.
const FLOW_WINDOW_MS = 15 * 60_000;

function localPath(publicUrl: string): string | null {
  const clean = publicUrl.split(/[?#]/)[0];
  if (!clean.startsWith(QC_PREFIX) || clean.includes("..")) return null;
  return path.join(process.cwd(), "public", clean);
}

async function readHead(file: string): Promise<Uint8Array | null> {
  const handle = await open(file, "r").catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// Grunden til at billedet ser beskåret ud, eller null.
export async function storedFrontProblem(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl || imageUrl.toLowerCase().split(/[?#]/)[0].endsWith(".png")) return null;
  const file = localPath(imageUrl);
  if (!file) return null;
  const head = await readHead(file);
  return head ? frontPhotoProblem(imageSize(head)) : null;
}

// Markerer varen og sender den til scan-appen ("Skal scannes"). En åben
// forespørgsel røres ikke; en eksisterende vurdering (Open Food Facts) beholder
// sine tal og får blot kategorien med.
export async function flagCroppedFront(productId: string, imageUrl: string | null, reason: string): Promise<void> {
  const now = new Date();
  await prisma.product.update({
    where: { id: productId },
    data: { frontImageSuspect: reason, frontImageSuspectUrl: imageUrl, frontImageSuspectAt: now, frontImageFixedAt: null },
  });
  const finding = { category: "IMAGE", code: "front_cropped", severity: "high", comment: `Forsidebilledet er ${reason} — tag forsiden om` };
  const review = await prisma.productQualityReview.findUnique({
    where: { productId },
    select: { categories: true, findings: true, scanRequestedAt: true, scanDoneAt: true },
  });
  if (!review) {
    await prisma.productQualityReview.create({
      data: {
        productId,
        score: 0,
        rating: "POOR",
        categories: [FRONT_CROPPED_CATEGORY],
        findings: [finding] as unknown as Prisma.InputJsonValue,
        scanRequestedAt: now,
      },
    });
    return;
  }
  const findings = Array.isArray(review.findings) ? (review.findings as unknown[]) : [];
  const requestOpen = review.scanRequestedAt && !review.scanDoneAt;
  await prisma.productQualityReview.update({
    where: { productId },
    data: {
      categories: review.categories.includes(FRONT_CROPPED_CATEGORY) ? undefined : [...review.categories, FRONT_CROPPED_CATEGORY],
      findings: [...findings.filter((f) => (f as { code?: string })?.code !== "front_cropped"), finding] as unknown as Prisma.InputJsonValue,
      ...(requestOpen ? {} : { scanRequestedAt: now, scanDoneAt: null, scanDoneByWorkerId: null }),
    },
  });
}

// Et nyt forsidefoto har erstattet det beskårne: sagen lukkes, og en
// forespørgsel, der kun handlede om billedet, er klaret.
export async function resolveCroppedFront(productId: string): Promise<void> {
  await prisma.product.updateMany({
    where: { id: productId, frontImageSuspectAt: { not: null }, frontImageFixedAt: null },
    data: { frontImageFixedAt: new Date() },
  });
  await prisma.productQualityReview.updateMany({
    where: { productId, categories: { equals: [FRONT_CROPPED_CATEGORY] }, scanRequestedAt: { not: null }, scanDoneAt: null },
    data: { scanDoneAt: new Date() },
  });
}

// Varer, hvis forsidefoto blev beskåret til AI'ens boks (kendetegn 2).
async function productsCroppedByLog(): Promise<Map<string, Date>> {
  const cropped = await prisma.debugLog.findMany({
    where: { event: "front_objects", message: { contains: CROPPED_LOG_TEXT }, flowId: { not: null } },
    select: { flowId: true, createdAt: true },
  });
  if (!cropped.length) return new Map();
  const created = await prisma.debugLog.findMany({
    where: { event: "product_create", productId: { not: null }, flowId: { in: cropped.map((row) => row.flowId as string) } },
    select: { flowId: true, productId: true, createdAt: true },
  });
  const croppedAt = new Map(cropped.map((row) => [row.flowId as string, row.createdAt]));
  const result = new Map<string, Date>();
  for (const row of created) {
    const at = croppedAt.get(row.flowId as string);
    if (at && row.createdAt.getTime() - at.getTime() <= FLOW_WINDOW_MS) result.set(row.productId as string, at);
  }
  return result;
}

async function fileCreatedAt(imageUrl: string | null): Promise<Date | null> {
  const file = imageUrl ? localPath(imageUrl) : null;
  if (!file) return null;
  const info = await stat(file).catch(() => null);
  return info ? info.mtime : null;
}

export async function checkFrontImages(): Promise<string> {
  let flagged = 0;
  let resolved = 0;
  let checked = 0;

  // Åbne sager, hvor billedet siden er skiftet: lukkes.
  const openCases = await prisma.product.findMany({
    where: { frontImageSuspectAt: { not: null }, frontImageFixedAt: null },
    select: { id: true, imageUrl: true, frontImageSuspectUrl: true },
  });
  for (const product of openCases) {
    if (product.imageUrl !== product.frontImageSuspectUrl && !(await storedFrontProblem(product.imageUrl))) {
      await resolveCroppedFront(product.id);
      resolved += 1;
    }
  }
  const stillOpen = new Set(openCases.map((p) => p.id));

  // Kendetegn 2: loggen. Et billede, der er taget efter beskæringen (nyt
  // forsidefoto), er i orden; et fritlagt PNG af det beskårne er ikke.
  const fromLog = await productsCroppedByLog();
  if (fromLog.size) {
    const products = await prisma.product.findMany({
      where: { id: { in: [...fromLog.keys()] } },
      select: { id: true, imageUrl: true, frontImageSuspectAt: true, frontImageFixedAt: true },
    });
    for (const product of products) {
      const croppedAt = fromLog.get(product.id) as Date;
      if (product.frontImageFixedAt && product.frontImageFixedAt > croppedAt) continue;
      if (product.frontImageSuspectAt && !product.frontImageFixedAt) continue;
      const isPng = (product.imageUrl ?? "").toLowerCase().split(/[?#]/)[0].endsWith(".png");
      const createdAt = await fileCreatedAt(product.imageUrl);
      const sameFlow = createdAt && createdAt.getTime() - croppedAt.getTime() <= FLOW_WINDOW_MS;
      if (!product.imageUrl || (!isPng && !sameFlow)) continue;
      await flagCroppedFront(product.id, product.imageUrl, "beskåret til AI'ens objektboks ved oprettelsen");
      stillOpen.add(product.id);
      flagged += 1;
    }
  }

  // Kendetegn 1: billedets form. Kun kamerafotos i qc-uploads (ikke fritlagte PNG).
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.product.findMany({
      where: { imageUrl: { startsWith: QC_PREFIX }, discontinued: false },
      select: { id: true, imageUrl: true, frontImageSuspectAt: true, frontImageFixedAt: true, frontImageSuspectUrl: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    for (const product of batch) {
      if (stillOpen.has(product.id)) continue;
      // Samme billede er allerede set og løst (fx godkendt af admin).
      if (product.frontImageFixedAt && product.frontImageSuspectUrl === product.imageUrl) continue;
      checked += 1;
      const problem = await storedFrontProblem(product.imageUrl);
      if (!problem) continue;
      await flagCroppedFront(product.id, product.imageUrl, problem);
      flagged += 1;
    }
    if (batch.length < 500) break;
  }

  return `${checked} forsidebilleder målt, ${flagged} beskårne sendt til scan-appen, ${resolved} rettet`;
}
