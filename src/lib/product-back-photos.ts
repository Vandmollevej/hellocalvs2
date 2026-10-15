import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callStructuredVision } from "@/lib/product-ai";
import { readStoredImageAsDataUrl, saveDataUrlImage } from "@/lib/qc-image-storage";
import { storeDetectedLabels } from "@/lib/product-label-scan";
import { contextAround } from "@/lib/spelling-engine";
import { debugLog, errorText } from "@/lib/debug-log";
import type { JobResult } from "@/lib/jobs/runs";
import {
  BACK_PHOTO_PROMPT_VERSION,
  BACK_PHOTO_SCHEMA,
  BACK_PHOTO_SYSTEM,
  backPhotoText,
  cleanBackPhotoAnalysis,
  fineReadFindings,
} from "@/lib/back-photo-ai";

// Ubeskårne bagsidebilleder (docs/DECISIONS.md 2026-10-15): Tilføj-kameraets
// energi-/indholdstrin uploader hele kamerabilledet under flowet; det gemmes
// byte for byte (kun metadata fjernes, aldrig beskåret eller skaleret) og
// kobles til varen ved oprettelsen. Nattens robot "back-photo-scan"
// analyserer hvert billede præcis ÉN gang — mærkninger, der ikke står på
// forsiden, finlæsning af teksten og udvidet stavekontrol — og billedet
// indgår derefter aldrig i nogen kørsel igen (analyzedAt). Billederne er ikke
// AiProductAnalysis-rækker, så nattens øvrige robotter ser dem ikke.

export const BACK_PHOTO_STEPS = ["nutrition", "ingredients"] as const;
export type BackPhotoStep = (typeof BACK_PHOTO_STEPS)[number];

// Et helt 4K-kamerabillede som JPEG; større afvises.
export const BACK_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
// Højst så mange billeder pr. nat (et AI-kald hver).
const MAX_PER_RUN = 100;
// Fejlede analyser prøves næste nat, højst så mange gange i alt.
const MAX_ATTEMPTS = 3;
// Billeder fra et flow, der aldrig blev til en vare, slettes efter så længe.
const ORPHAN_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
// Fund fra finlæsningen bliver forslag (aldrig automatiske rettelser).
const FINE_READ_REASON = "fine_read";

export function isBackPhotoStep(value: unknown): value is BackPhotoStep {
  return typeof value === "string" && (BACK_PHOTO_STEPS as readonly string[]).includes(value);
}

export async function saveBackPhoto(input: {
  photo: string;
  step: BackPhotoStep;
  flowId: string;
  userId: string | null;
  width: number | null;
  height: number | null;
}): Promise<{ id: string; productId: string | null } | null> {
  const imageUrl = await saveDataUrlImage(input.photo);
  if (!imageUrl) return null;
  // Er varen allerede oprettet (uploaden blev færdig efter oprettelsen),
  // kobles billedet til den med det samme.
  const job = await prisma.quickEnrichmentJob.findFirst({
    where: { input: { path: ["flowId"], equals: input.flowId } },
    select: { productId: true },
  });
  const row = await prisma.productBackPhoto.create({
    data: {
      imageUrl,
      step: input.step,
      flowId: input.flowId,
      userId: input.userId,
      width: input.width,
      height: input.height,
      productId: job?.productId ?? null,
    },
    select: { id: true, productId: true },
  });
  return row;
}

// Kaldes, når varen er oprettet/genscannet: flowets bagsidebilleder hører til den.
export async function linkBackPhotos(flowId: string | null, productId: string, userId: string | null): Promise<number> {
  if (!flowId) return 0;
  const result = await prisma.productBackPhoto.updateMany({
    where: { flowId, productId: null, ...(userId ? { OR: [{ userId }, { userId: null }] } : {}) },
    data: { productId },
  });
  return result.count;
}

async function deleteStoredFile(imageUrl: string) {
  const match = /^\/product-images\/qc-uploads\/([0-9a-f-]{36}\.(?:png|jpg|webp))$/i.exec(imageUrl);
  if (!match) return;
  await unlink(path.join(process.cwd(), "public", "product-images", "qc-uploads", match[1])).catch(() => {});
}

// Billeder uden vare: kobles via flowets oprettelse, ellers slettes de efter
// ORPHAN_MAX_AGE_MS (flowet blev aldrig til en vare).
async function settleOrphans(): Promise<{ linked: number; deleted: number }> {
  const orphans = await prisma.productBackPhoto.findMany({
    where: { productId: null, analyzedAt: null },
    select: { id: true, flowId: true, imageUrl: true, createdAt: true },
    take: 500,
  });
  let linked = 0;
  let deleted = 0;
  for (const orphan of orphans) {
    const job = await prisma.quickEnrichmentJob.findFirst({
      where: { input: { path: ["flowId"], equals: orphan.flowId } },
      select: { productId: true },
    });
    if (job) {
      await prisma.productBackPhoto.update({ where: { id: orphan.id }, data: { productId: job.productId } });
      linked += 1;
    } else if (Date.now() - orphan.createdAt.getTime() > ORPHAN_MAX_AGE_MS) {
      await deleteStoredFile(orphan.imageUrl);
      await prisma.productBackPhoto.delete({ where: { id: orphan.id } });
      deleted += 1;
    }
  }
  return { linked, deleted };
}

// Udvidet stavekontrol: forskelle mellem varens gemte ingrediensliste og den
// finlæste tekst bliver forslag under admin → Stavekontrol (aldrig rettet
// automatisk). Ord, admin allerede har afgjort, foreslås ikke igen.
async function fineReadSpelling(productId: string, fineRead: string | null, confidence: number): Promise<number> {
  if (!fineRead) return 0;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { ingredientsText: true } });
  const stored = product?.ingredientsText ?? "";
  // Sproguafhængig: de to tekster er den samme liste, så ingen ordbog behøves.
  if (!stored) return 0;
  const findings = fineReadFindings(stored, fineRead);
  if (!findings.length) return 0;
  const earlier = await prisma.spellingIssue.findMany({
    where: { productId, status: { in: ["PENDING", "REJECTED", "REVERTED"] } },
    select: { word: true },
  });
  const known = new Set(earlier.map((issue) => issue.word.trim()));
  const issues: Prisma.SpellingIssueCreateManyInput[] = findings
    .filter((finding) => !known.has(finding.word.trim()))
    .map((finding) => {
      const context = contextAround(stored, finding.start, finding.end);
      return {
        productId,
        word: finding.word,
        suggestion: finding.suggestion,
        // Under robottens grænse for automatisk rettelse: altid et forslag.
        confidence: Math.min(0.89, Math.round(confidence * finding.similarity * 100) / 100),
        reason: FINE_READ_REASON,
        contextBefore: context.before,
        contextAfter: context.after,
        position: finding.start,
        status: "PENDING" as const,
      };
    });
  if (issues.length) await prisma.spellingIssue.createMany({ data: issues });
  return issues.length;
}

type AnalyzeOutcome = { labels: number; spelling: number };

async function analyzePhoto(row: { id: string; productId: string; step: string; imageUrl: string }): Promise<AnalyzeOutcome> {
  const photo = await readStoredImageAsDataUrl(row.imageUrl);
  if (!photo) throw new Error("Billedet findes ikke længere på disken");
  const product = await prisma.product.findUnique({
    where: { id: row.productId },
    select: {
      name: true,
      brand: { select: { name: true } },
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
  if (!product) throw new Error("Varen findes ikke længere");
  const response = await callStructuredVision<unknown>({
    photo,
    schemaName: "hello_cal_back_photo",
    schema: BACK_PHOTO_SCHEMA,
    system: BACK_PHOTO_SYSTEM,
    text: backPhotoText({ productName: product.name, brand: product.brand?.name ?? null, step: row.step }),
  });
  const analysis = cleanBackPhotoAnalysis(response.value);
  // Mærkerne gemmes som forsidens (product_labels + tomme filtre), men uden
  // fritskrabning og uden at markere forsiden som scannet.
  const labels = await storeDetectedLabels({
    productId: row.productId,
    analysisId: null,
    sourceUrl: row.imageUrl,
    labels: analysis.labels,
    filters: product.filters,
    markScanned: false,
    cutouts: false,
  });
  const spelling = await fineReadSpelling(row.productId, analysis.ingredientsText, analysis.textConfidence);
  await prisma.productBackPhoto.update({
    where: { id: row.id },
    data: {
      analyzedAt: new Date(),
      error: null,
      result: {
        promptVersion: BACK_PHOTO_PROMPT_VERSION,
        model: response.model,
        ...analysis,
        storedLabels: labels,
        spellingSuggestions: spelling,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return { labels, spelling };
}

export async function runBackPhotoScan(): Promise<JobResult> {
  const startedAt = Date.now();
  const orphans = await settleOrphans();
  const rows = await prisma.productBackPhoto.findMany({
    where: { analyzedAt: null, productId: { not: null }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
    select: { id: true, productId: true, step: true, imageUrl: true, attempts: true },
  });
  let analyzed = 0;
  let failed = 0;
  let labels = 0;
  let spelling = 0;
  for (const row of rows) {
    if (!row.productId) continue;
    // Claim: kun én proces tager billedet (forsøget tælles før kaldet).
    const claimed = await prisma.productBackPhoto.updateMany({
      where: { id: row.id, analyzedAt: null, attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const outcome = await analyzePhoto({ id: row.id, productId: row.productId, step: row.step, imageUrl: row.imageUrl });
      analyzed += 1;
      labels += outcome.labels;
      spelling += outcome.spelling;
    } catch (error) {
      failed += 1;
      const message = errorText(error).slice(0, 500);
      // Sidste forsøg: billedet er færdigt (analyseres aldrig igen).
      const final = row.attempts + 1 >= MAX_ATTEMPTS;
      await prisma.productBackPhoto.update({
        where: { id: row.id },
        data: { error: message, ...(final ? { analyzedAt: new Date() } : {}) },
      });
      console.error(`[back-photo-scan] ${row.id} fejlede`, error);
    }
  }
  const message =
    `${analyzed} bagsidebilleder analyseret, ${labels} mærkninger gemt, ${spelling} staveforslag` +
    (failed ? `, ${failed} fejl` : "") +
    (orphans.linked ? `, ${orphans.linked} koblet til varen` : "") +
    (orphans.deleted ? `, ${orphans.deleted} uden vare slettet` : "");
  void debugLog({
    category: "cron",
    event: "back_photo_scan",
    message: `Bagsidebilleder: ${message}`,
    durationMs: Date.now() - startedAt,
    data: { analyzed, failed, labels, spelling, ...orphans },
  });
  return { message, count: analyzed };
}
