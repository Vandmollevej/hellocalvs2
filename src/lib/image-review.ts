import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ImageReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripImageMetadata } from "@/lib/image-metadata";
import { sniffImage } from "@/lib/product-image-upload";

// Admin → Billedbehandling → Fritlagte billeder (docs/DECISIONS.md 2026-10-17).
// rembg-filer uploades (filnavn = EAN), sammenlignes med varens nuværende
// billede, og Accepter lægger filen direkte på varen. Alt kan fortrydes via
// loggen (ImageReviewLog).

const PUBLIC_DIR = path.join(process.cwd(), "public");
export const REMBG_PUBLIC_PREFIX = "/product-images/rembg-review";
const REMBG_DIR = path.join(PUBLIC_DIR, "product-images", "rembg-review");
export const REMBG_MAX_BYTES = 25 * 1024 * 1024;

export const REVIEW_TABS = [
  { key: "pending", label: "Afventer", status: "PENDING" },
  { key: "existing", label: "Eksisterende", status: "EXISTING" },
  { key: "rejected", label: "Afvist", status: "REJECTED" },
  { key: "accepted", label: "Accepteret", status: "ACCEPTED" },
  { key: "unmatched", label: "Ikke matchet", status: "UNMATCHED" },
] as const satisfies readonly { key: string; label: string; status: ImageReviewStatus }[];

// Første 8–14-cifrede tal i filnavnet er stregkoden (EAN_2.png, EAN_rembg.png …).
export function barcodeFromFileName(fileName: string): string | null {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const match = /(?<!\d)(\d{8,14})(?!\d)/.exec(base);
  return match ? match[1] : null;
}

// En 12-cifret UPC og dens 13-cifrede EAN er samme vare.
export function eanVariants(code: string) {
  const stripped = code.replace(/^0+/, "");
  const variants = new Set<string>([code]);
  if (stripped) {
    variants.add(stripped);
    for (const length of [8, 12, 13, 14]) if (stripped.length <= length) variants.add(stripped.padStart(length, "0"));
  }
  return [...variants];
}

// Har varens nuværende billede allerede gennemsigtig baggrund? Læser kun
// filer, der ligger lokalt; en fjern URL regnes ikke som fritlagt.
async function currentIsCutout(productId: string, imageUrl: string | null): Promise<boolean> {
  if (!imageUrl) return false;
  if (await prisma.imageReview.findFirst({ where: { productId, status: "ACCEPTED" }, select: { id: true } })) return true;
  if (/cutout|rembg|bria|fritlagt/i.test(imageUrl)) return true;
  if (!imageUrl.startsWith("/product-images/")) return false;
  try {
    const file = path.resolve(PUBLIC_DIR, "." + imageUrl.split("?")[0]);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return false;
    const buf = await readFile(file);
    // PNG colour type 4 (grey+alpha) eller 6 (RGBA).
    return buf.length > 26 && buf.readUInt32BE(0) === 0x89504e47 && (buf[25] === 4 || buf[25] === 6);
  } catch {
    return false;
  }
}

export type IngestResult = { fileName: string; status: ImageReviewStatus | "FAILED"; message?: string; id?: string };

export async function ingestRembgFile(params: {
  fileName: string;
  buffer: Buffer;
  batchId: string;
  adminId: string;
}): Promise<IngestResult> {
  const { fileName, buffer, batchId, adminId } = params;
  const sniffedRaw = sniffImage(buffer);
  if (!sniffedRaw) return { fileName, status: "FAILED", message: "Ikke et PNG-, JPEG- eller WebP-billede" };

  let clean: Buffer;
  try {
    clean = stripImageMetadata(buffer, sniffedRaw.mime);
  } catch {
    return { fileName, status: "FAILED", message: "Billedet kunne ikke renses for metadata" };
  }

  await mkdir(REMBG_DIR, { recursive: true });
  const stored = `${randomUUID()}.${sniffedRaw.ext}`;
  await writeFile(path.join(REMBG_DIR, stored), clean);
  const processedUrl = `${REMBG_PUBLIC_PREFIX}/${stored}`;

  const barcode = barcodeFromFileName(fileName);
  const found = barcode
    ? await prisma.barcode.findFirst({
        where: { code: { in: eanVariants(barcode) } },
        select: { product: { select: { id: true, imageUrl: true, deletedAt: true } } },
      })
    : null;
  const product = found?.product && !found.product.deletedAt ? found.product : null;

  let status: ImageReviewStatus = "UNMATCHED";
  if (product) status = (await currentIsCutout(product.id, product.imageUrl)) ? "EXISTING" : "PENDING";

  // Samme fil uploadet igen for samme vare: erstat den ubehandlede række i
  // stedet for at lave en dublet.
  if (product) {
    await prisma.imageReview.deleteMany({ where: { productId: product.id, status: { in: ["PENDING", "EXISTING"] } } });
  }

  const row = await prisma.imageReview.create({
    data: {
      productId: product?.id ?? null,
      barcode,
      fileName: fileName.slice(0, 255),
      processedUrl,
      originalUrl: product?.imageUrl ?? null,
      status,
      batchId,
      createdById: adminId,
    },
  });
  return {
    fileName,
    status,
    id: row.id,
    message: status === "UNMATCHED" ? (barcode ? `Ingen vare har EAN ${barcode}` : "Filnavnet indeholder ikke et EAN") : undefined,
  };
}

export type ReviewAction = "ACCEPT" | "REJECT";

type LogItem = { id: string; title: string; imageUrl: string | null; previousUrl: string | null; previousStatus: ImageReviewStatus; productId: string | null };

// Accepter/Afvis for en eller flere rækker. Hele kaldet er én logpost, så en
// bulk-handling står som én foldbar linje i loggen.
export async function decideReviews(ids: string[], action: ReviewAction, adminId: string) {
  const rows = await prisma.imageReview.findMany({ where: { id: { in: ids } } });
  const productIds = rows.map((row) => row.productId).filter((id): id is string => Boolean(id));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, imageUrl: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const items: LogItem[] = [];
  const skipped: string[] = [];
  const now = new Date();

  for (const row of rows) {
    // Et afvist billede kan stadig accepteres; accepterede ændres kun via loggen.
    if (row.status === "ACCEPTED" || row.status === "UNMATCHED" || (row.status === "REJECTED" && action === "REJECT")) continue;
    const product = row.productId ? byId.get(row.productId) : undefined;
    if (action === "ACCEPT") {
      if (!product) {
        skipped.push(row.id);
        continue;
      }
      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: row.processedUrl, pendingImageUrl: null, imageStatus: "APPROVED", imageNeedsNew: false },
        }),
        prisma.imageReview.update({
          where: { id: row.id },
          data: { status: "ACCEPTED", originalUrl: product.imageUrl, decidedAt: now },
        }),
      ]);
      items.push({ id: row.id, title: product.name, imageUrl: row.processedUrl, previousUrl: product.imageUrl, previousStatus: row.status, productId: product.id });
    } else {
      await prisma.imageReview.update({ where: { id: row.id }, data: { status: "REJECTED", decidedAt: now } });
      items.push({ id: row.id, title: product?.name ?? row.fileName, imageUrl: row.processedUrl, previousUrl: null, previousStatus: row.status, productId: product?.id ?? null });
    }
  }

  if (items.length > 0) {
    await prisma.imageReviewLog.create({
      data: { scope: "REMBG", action, itemCount: items.length, items, createdById: adminId },
    });
  }
  return { done: items.map((item) => item.id), skipped };
}

// Fortryd en logpost: accepterede varer får deres gamle billede igen, og alle
// rækker går tilbage til den status, de havde før.
export async function undoLog(logId: string) {
  const log = await prisma.imageReviewLog.findUnique({ where: { id: logId } });
  if (!log || log.scope !== "REMBG" || log.undoneAt) return { ok: false as const, message: "Kan ikke fortrydes" };
  const items = log.items as unknown as LogItem[];
  for (const item of items) {
    if (log.action === "ACCEPT" && item.productId) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { imageUrl: true } });
      // Er billedet siden ændret af andre, rører vi det ikke.
      if (product?.imageUrl === item.imageUrl) {
        await prisma.product.update({ where: { id: item.productId }, data: { imageUrl: item.previousUrl } });
      }
    }
    await prisma.imageReview.updateMany({ where: { id: item.id }, data: { status: item.previousStatus, decidedAt: null } });
  }
  await prisma.imageReviewLog.update({ where: { id: logId }, data: { undoneAt: new Date() } });
  return { ok: true as const, count: items.length };
}
