import { readFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callStructuredVision } from "@/lib/product-ai";
import {
  LABELS_PROMPT_VERSION,
  LABELS_SCHEMA,
  LABELS_SYSTEM,
  cleanLabelsAnalysis,
  labelsText,
} from "@/lib/product-label-ai";
import { labelsToFilterPatch } from "@/lib/product-label-filters";
import { mergeSourcedLabels, pickSources, type SourcedLabel } from "@/lib/product-label-sources";

// Natligt job "label-scan" (docs/DECISIONS.md 2026-10-02): finder mærkater
// (laktosefri, Haltungsform, QMilch, Ø-mærket …) på varer, der ikke er
// scannet for mærkater endnu. Lavere prioritet end selve scanningen, så det
// kører kun om natten og højst MAX_PER_RUN varer pr. kørsel.
//
// Pr. vare: OpenAI læser hvert foto af emballagen (2026-10-15): forsiden
// (helst originalfotoet fra kamera-flowet, ellers varens billede), de skjulte
// helbilleder af hele varen (PACKAGE), stregkodefotoet (ofte bagsiden) og
// energi-/indholdsfotoet, når der intet helbillede er af det trin →
// product_labels → ét ImageCutoutJob (PRODUCT_LABEL) pr. mærke med boks, så
// image-agent fritskraber mærket → sikre fund udfylder ProductFilters.

const MAX_PER_RUN = 150;
const MIN_STORE_CONFIDENCE = 0.5;
const MIME_BY_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function loadPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (!url.startsWith("/")) return null;
  const root = path.join(process.cwd(), "public");
  const file = path.join(root, path.normalize(url).replace(/^([/\\])+/, ""));
  if (!file.startsWith(root)) return null;
  const mime = MIME_BY_EXT[path.extname(file).toLowerCase()];
  if (!mime) return null;
  const buffer = await readFile(file).catch(() => null);
  return buffer ? `data:${mime};base64,${buffer.toString("base64")}` : null;
}

// Luft om boksen som ved logoet (src/lib/image-cutout-jobs.ts).
function padBox(box: { x: number; y: number; width: number; height: number }, padding: number) {
  const x = Math.max(0, box.x - box.width * padding);
  const y = Math.max(0, box.y - box.height * padding);
  return { x, y, width: Math.min(1 - x, box.width * (1 + 2 * padding)), height: Math.min(1 - y, box.height * (1 + 2 * padding)) };
}

type Candidate = {
  id: string;
  name: string;
  imageUrl: string | null;
  pendingImageUrl: string | null;
  brand: { name: string } | null;
  aiAnalyses: { id: string; kind: string; imageUrl: string | null; prediction: unknown }[];
  filters: {
    organic: string | null;
    glutenFree: string | null;
    lactoseFree: string | null;
    sugarFree: string | null;
    vegan: string | null;
    vegetarian: string | null;
    wholeGrain: string | null;
    keyhole: string | null;
    countryOfOrigin: string | null;
    animalWelfare: string[];
    certifications: string[];
  } | null;
};

export async function storeDetectedLabels({
  productId,
  labels,
  filters,
}: {
  productId: string;
  labels: SourcedLabel[];
  filters: Candidate["filters"];
}) {
  const kept = labels.filter((l) => l.confidence >= MIN_STORE_CONFIDENCE);
  await prisma.$transaction(async (tx) => {
    for (const label of kept) {
      const existing = await tx.productLabel.findUnique({ where: { productId_key: { productId, key: label.key } }, select: { id: true, cutoutJobId: true, imageUrl: true } });
      const base = {
        name: label.name,
        text: label.text,
        category: label.category,
        box: (label.box ?? undefined) as Prisma.InputJsonValue | undefined,
        confidence: label.confidence,
      };
      const row = existing
        ? await tx.productLabel.update({ where: { id: existing.id }, data: base })
        : await tx.productLabel.create({ data: { ...base, productId, key: label.key } });
      // Fritskrabning kun én gang pr. mærke, og kun når der er en boks.
      if (label.box && !existing?.cutoutJobId && !existing?.imageUrl) {
        const job = await tx.imageCutoutJob.create({
          data: {
            kind: "PRODUCT_LABEL",
            sourceUrl: label.sourceUrl,
            analysisId: label.analysisId,
            productId,
            cropBox: padBox(label.box, 0.08),
            recognizedText: label.text ?? label.name,
            confidence: label.confidence,
          },
        });
        await tx.productLabel.update({ where: { id: row.id }, data: { cutoutJobId: job.id } });
      }
    }
    const patch = labelsToFilterPatch(kept, filters);
    if (Object.keys(patch).length) {
      await tx.productFilters.upsert({ where: { productId }, create: { productId, ...patch }, update: patch });
    }
    await tx.product.update({ where: { id: productId }, data: { labelsScannedAt: new Date() } });
  });
  return kept.length;
}

// Helbilleder, hvis upload først svarede efter oprettelsen, kobles på
// stregkoden (src/lib/package-photos.ts gør det samme ved oprettelsen).
async function linkOrphanPackagePhotos() {
  const orphans = await prisma.aiProductAnalysis.findMany({
    where: { kind: "PACKAGE", productId: null, barcode: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, barcode: true },
  });
  const codes = Array.from(new Set(orphans.map((o) => o.barcode as string)));
  if (!codes.length) return;
  const barcodes = await prisma.barcode.findMany({ where: { code: { in: codes } }, select: { code: true, productId: true } });
  const productByCode = new Map(barcodes.map((b) => [b.code, b.productId]));
  for (const orphan of orphans) {
    const productId = productByCode.get(orphan.barcode as string);
    if (!productId) continue;
    await prisma.aiProductAnalysis.update({ where: { id: orphan.id }, data: { productId } });
    await prisma.product.update({ where: { id: productId }, data: { labelsScannedAt: null } });
  }
}

const PHOTO_KINDS = ["FRONT", "PACKAGE", "BARCODE", "NUTRITION", "INGREDIENTS"] as const;

export async function scanProductLabels(): Promise<string> {
  await linkOrphanPackagePhotos().catch((error) => console.error("[label-scan] helbilleder kunne ikke kobles", error));
  const products: Candidate[] = await prisma.product.findMany({
    where: {
      labelsScannedAt: null,
      privateOwnerId: null,
      OR: [
        { imageUrl: { not: null } },
        { pendingImageUrl: { not: null } },
        { aiAnalyses: { some: { kind: { in: ["FRONT", "PACKAGE"] }, imageUrl: { not: null } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      pendingImageUrl: true,
      brand: { select: { name: true } },
      aiAnalyses: {
        where: { kind: { in: [...PHOTO_KINDS] }, imageUrl: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, kind: true, imageUrl: true, prediction: true },
      },
      filters: {
        select: {
          organic: true,
          glutenFree: true,
          lactoseFree: true,
          sugarFree: true,
          vegan: true,
          vegetarian: true,
          wholeGrain: true,
          keyhole: true,
          countryOfOrigin: true,
          animalWelfare: true,
          certifications: true,
        },
      },
    },
  });

  let scanned = 0;
  let found = 0;
  let failed = 0;
  let skipped = 0;
  let photos = 0;
  for (const product of products) {
    const labels: SourcedLabel[] = [];
    let read = 0;
    let errors = 0;
    for (const source of pickSources(product)) {
      const photo = await loadPhoto(source.url);
      if (!photo) continue;
      try {
        const result = await callStructuredVision<unknown>({
          photo,
          schemaName: "hello_cal_product_labels",
          schema: LABELS_SCHEMA,
          system: LABELS_SYSTEM,
          text: labelsText({ productName: product.name, brand: product.brand?.name ?? null, side: source.side }),
        });
        for (const label of cleanLabelsAnalysis(result.value).labels) {
          labels.push({ ...label, sourceUrl: source.url, analysisId: source.analysisId });
        }
        read += 1;
      } catch (error) {
        errors += 1;
        console.error(`[label-scan] ${product.id} fejlede (${LABELS_PROMPT_VERSION})`, error);
      }
    }
    photos += read;
    if (!read && errors) {
      // Prøves igen næste nat.
      failed += 1;
      continue;
    }
    if (!read) {
      // Intet læsbart foto: markér som scannet, så varen ikke blokerer køen hver nat.
      await prisma.product.update({ where: { id: product.id }, data: { labelsScannedAt: new Date() } });
      skipped += 1;
      continue;
    }
    try {
      found += await storeDetectedLabels({ productId: product.id, labels: mergeSourcedLabels(labels), filters: product.filters });
      scanned += 1;
    } catch (error) {
      failed += 1;
      console.error(`[label-scan] ${product.id} kunne ikke gemmes`, error);
    }
  }
  return `${products.length} varer i kø, ${scanned} scannet (${photos} fotos), ${found} mærkater fundet, ${skipped} uden foto, ${failed} fejl`;
}
