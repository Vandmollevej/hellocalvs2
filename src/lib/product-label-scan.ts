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
  type DetectedLabel,
} from "@/lib/product-label-ai";
import { labelsToFilterPatch } from "@/lib/product-label-filters";

// Natligt job "label-scan" (docs/DECISIONS.md 2026-10-02): finder mærkater
// (laktosefri, Haltungsform, QMilch …) på forsiden af varer, der ikke er
// scannet for mærkater endnu. Lavere prioritet end selve scanningen, så det
// kører kun om natten og højst MAX_PER_RUN varer pr. kørsel.
//
// Pr. vare: OpenAI læser forsidefotoet (helst originalfotoet fra
// kamera-flowet, ellers varens billede) → product_labels → ét
// ImageCutoutJob (PRODUCT_LABEL) pr. mærke med boks, så image-agent
// fritskraber mærket → sikre fund udfylder tomme felter i ProductFilters.

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
  aiAnalyses: { id: string; imageUrl: string | null }[];
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

// Originalfotoet fra kamera-flowet er bedst: mærkerne står skarpt og i fuld
// opløsning. Et fritlagt varebillede dur også. Eksterne (https) billeder
// fra Open Food Facts bruges som sidste udvej.
function pickSource(product: Candidate): { url: string; analysisId: string | null } | null {
  const front = product.aiAnalyses.find((a) => a.imageUrl);
  if (front?.imageUrl) return { url: front.imageUrl, analysisId: front.id };
  const url = product.imageUrl ?? product.pendingImageUrl;
  return url ? { url, analysisId: null } : null;
}

export async function storeDetectedLabels({
  productId,
  analysisId,
  sourceUrl,
  labels,
  filters,
}: {
  productId: string;
  analysisId: string | null;
  sourceUrl: string;
  labels: DetectedLabel[];
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
            sourceUrl,
            analysisId,
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

export async function scanProductLabels(): Promise<string> {
  const products: Candidate[] = await prisma.product.findMany({
    where: {
      labelsScannedAt: null,
      privateOwnerId: null,
      OR: [{ imageUrl: { not: null } }, { pendingImageUrl: { not: null } }, { aiAnalyses: { some: { kind: "FRONT", imageUrl: { not: null } } } }],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      name: true,
      imageUrl: true,
      pendingImageUrl: true,
      brand: { select: { name: true } },
      aiAnalyses: { where: { kind: "FRONT", imageUrl: { not: null } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, imageUrl: true } },
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
  for (const product of products) {
    const source = pickSource(product);
    const photo = source ? await loadPhoto(source.url) : null;
    if (!source || !photo) {
      // Intet læsbart foto: markér som scannet, så varen ikke blokerer køen hver nat.
      await prisma.product.update({ where: { id: product.id }, data: { labelsScannedAt: new Date() } });
      skipped += 1;
      continue;
    }
    try {
      const result = await callStructuredVision<unknown>({
        photo,
        schemaName: "hello_cal_product_labels",
        schema: LABELS_SCHEMA,
        system: LABELS_SYSTEM,
        text: labelsText({ productName: product.name, brand: product.brand?.name ?? null }),
      });
      const analysis = cleanLabelsAnalysis(result.value);
      found += await storeDetectedLabels({
        productId: product.id,
        analysisId: source.analysisId,
        sourceUrl: source.url,
        labels: analysis.labels,
        filters: product.filters,
      });
      scanned += 1;
    } catch (error) {
      failed += 1;
      console.error(`[label-scan] ${product.id} fejlede (${LABELS_PROMPT_VERSION})`, error);
    }
  }
  return `${products.length} varer i kø, ${scanned} scannet, ${found} mærkater fundet, ${skipped} uden foto, ${failed} fejl`;
}
