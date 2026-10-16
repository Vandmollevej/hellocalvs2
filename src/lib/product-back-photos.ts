import { unlink } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callStructuredText, callStructuredVision } from "@/lib/product-ai";
import { readStoredImageAsDataUrl, saveDataUrlImage } from "@/lib/qc-image-storage";
import { storeDetectedLabels } from "@/lib/product-label-scan";
import { contextAround, replaceAt } from "@/lib/spelling-engine";
import { loadSpellingDictionary } from "@/lib/spelling-dictionary";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { findIngredientsSection } from "@/lib/product-ocr";
import { cleanLabelsAnalysis } from "@/lib/product-label-ai";
import {
  DOUBT_SCHEMA,
  DOUBT_SYSTEM,
  SURE_CONFIDENCE,
  classifyFindings,
  cleanDoubtAnswers,
  doubtText,
} from "@/lib/back-photo-spelling";
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
// 2026-10-15: OCR og intern AI først — quality-control-agent læser billedet
// lokalt (localResult); OpenAI læser kun billedet uden lokale mærkefund, og
// stavningen afgøres af ordbogen med AI kun ved tvivl.

// Originalbilleder fra ALLE trin (brugerens krav 2026-10-16: "Jeg skal have
// original af det hele"): stregkode, forside, energi og indhold — hver
// optagelse, hele kamerabilledet, koblet til varen, så de planlagte jobs kan
// bruge dem. Kun energi/indhold analyseres af "back-photo-scan".
export const BACK_PHOTO_STEPS = ["barcode", "front", "nutrition", "ingredients"] as const;
export type BackPhotoStep = (typeof BACK_PHOTO_STEPS)[number];
export const ANALYZED_BACK_PHOTO_STEPS = ["nutrition", "ingredients"] as const;

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
// Tvivlsomt ord vurderet af AI.
const FINE_READ_AI_REASON = "fine_read_ai";
// Venter et billede på den lokale læsning (quality-control-agent) længere end
// dette, analyseres det uden (fx hvis robotten står stille).
const LOCAL_WAIT_MS = 24 * 60 * 60 * 1000;

type LocalResult = { labels?: unknown; text?: unknown; confidence?: unknown };

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
// `archiveOnly` (2-års tjekket): billederne gemmes som originaler på varen,
// men analyseres ikke — varens data ændres først efter admins vurdering.
export async function linkBackPhotos(
  flowId: string | null,
  productId: string,
  userId: string | null,
  options: { archiveOnly?: boolean } = {},
): Promise<number> {
  if (!flowId) return 0;
  const result = await prisma.productBackPhoto.updateMany({
    where: { flowId, productId: null, ...(userId ? { OR: [{ userId }, { userId: null }] } : {}) },
    data: options.archiveOnly
      ? { productId, analyzedAt: new Date(), result: { archiveOnly: true, reason: "quality-check" } }
      : { productId },
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

// Udvidet stavekontrol (brugerens valg 2026-10-15: "Ordbog først, AI ved
// tvivl"): forskelle mellem varens gemte ingrediensliste og den finlæste
// tekst afgøres af ordbogen (src/lib/back-photo-spelling.ts). Sikre rettelser
// laves (AUTO_FIXED, kan fortrydes under admin → Stavekontrol); ord, ordbogen
// er i tvivl om, vurderes af AI i sammenhængen og bliver forslag. Ord, admin
// allerede har afgjort, foreslås ikke igen.
async function fineReadSpelling(productId: string, fineRead: string | null): Promise<{ fixed: number; pending: number }> {
  if (!fineRead) return { fixed: 0, pending: 0 };
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { ingredientsText: true } });
  const stored = product?.ingredientsText ?? "";
  // Sproguafhængig sammenligning: de to tekster er den samme liste.
  if (!stored) return { fixed: 0, pending: 0 };
  const earlier = await prisma.spellingIssue.findMany({
    where: { productId, status: { in: ["PENDING", "REJECTED", "REVERTED"] } },
    select: { word: true },
  });
  const known = new Set(earlier.map((issue) => issue.word.trim()));
  const findings = fineReadFindings(stored, fineRead).filter((finding) => !known.has(finding.word.trim()));
  if (!findings.length) return { fixed: 0, pending: 0 };
  const { sure, doubtful } = classifyFindings(findings, await loadSpellingDictionary());

  const issue = (finding: { word: string; start: number; end: number }) => {
    const context = contextAround(stored, finding.start, finding.end);
    return { productId, word: finding.word, contextBefore: context.before, contextAfter: context.after, position: finding.start };
  };
  const issues: Prisma.SpellingIssueCreateManyInput[] = [];

  // Sikre rettelser (bagfra, så placeringerne foran stadig passer).
  let text = stored;
  for (const finding of [...sure].sort((a, b) => b.start - a.start)) {
    text = replaceAt(text, finding.start, finding.end, finding.suggestion);
    issues.push({ ...issue(finding), suggestion: finding.suggestion, confidence: SURE_CONFIDENCE, reason: FINE_READ_REASON, status: "AUTO_FIXED", appliedText: finding.suggestion });
  }
  let fixed = 0;
  if (text !== stored) {
    // Kun hvis listen ikke er ændret imens.
    const updated = await prisma.product.updateMany({ where: { id: productId, ingredientsText: stored }, data: { ingredientsText: text } });
    if (updated.count) {
      fixed = sure.length;
      await syncProductNutritionFeaturesSafely(productId);
    } else {
      issues.length = 0;
    }
  }

  // Tvivl: AI vurderer ordene i sammenhængen — altid et forslag.
  if (doubtful.length) {
    try {
      const response = await callStructuredText<unknown>({
        system: DOUBT_SYSTEM,
        text: doubtText(stored, doubtful),
        schemaName: "hello_cal_spelling_doubt",
        schema: DOUBT_SCHEMA,
      });
      for (const answer of cleanDoubtAnswers(response.value, doubtful.length)) {
        const finding = doubtful[answer.index];
        if (!answer.correct || answer.correct === finding.word) continue;
        issues.push({
          ...issue(finding),
          suggestion: answer.correct,
          confidence: Math.min(0.89, Math.round(answer.confidence * 100) / 100),
          reason: FINE_READ_AI_REASON,
          status: "PENDING" as const,
        });
      }
    } catch (error) {
      console.error(`[back-photo-scan] AI-vurdering af tvivlsomme ord fejlede for ${productId}`, error);
    }
  }
  if (issues.length) await prisma.spellingIssue.createMany({ data: issues });
  return { fixed, pending: issues.filter((row) => row.status === "PENDING").length };
}

type AnalyzeOutcome = { labels: number; spelling: number; fixed: number; vision: boolean };

async function analyzePhoto(row: { id: string; productId: string; step: string; imageUrl: string; localResult: unknown }): Promise<AnalyzeOutcome> {
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

  // Intern AI først (brugerens regel 2026-10-15): den lokale læsning
  // (back_local.py) giver mærker og tekst. OpenAI læser kun billedet, når den
  // lokale søgning ingen mærker fandt.
  const local = (row.localResult ?? null) as LocalResult | null;
  const localLabels = local ? cleanLabelsAnalysis({ labels: local.labels }).labels : [];
  const localText = typeof local?.text === "string" ? local.text : "";
  let labelsFound = localLabels;
  let fineRead = localText ? findIngredientsSection(localText) : null;
  let vision: { model: string; analysis: ReturnType<typeof cleanBackPhotoAnalysis> } | null = null;
  if (!localLabels.length) {
    const photo = await readStoredImageAsDataUrl(row.imageUrl);
    if (!photo) throw new Error("Billedet findes ikke længere på disken");
    const response = await callStructuredVision<unknown>({
      photo,
      schemaName: "hello_cal_back_photo",
      schema: BACK_PHOTO_SCHEMA,
      system: BACK_PHOTO_SYSTEM,
      text: backPhotoText({ productName: product.name, brand: product.brand?.name ?? null, step: row.step }),
    });
    const analysis = cleanBackPhotoAnalysis(response.value);
    vision = { model: response.model, analysis };
    labelsFound = analysis.labels;
    // AI'ens læsning er grundigere end den lokale, når den alligevel er lavet.
    fineRead = analysis.ingredientsText ?? fineRead;
  }
  // Mærkerne gemmes som forsidens (product_labels + filtre), men uden
  // fritskrabning og uden at markere forsiden som scannet.
  const labels = await storeDetectedLabels({
    productId: row.productId,
    analysisId: null,
    sourceUrl: row.imageUrl,
    labels: labelsFound,
    filters: product.filters,
    markScanned: false,
    cutouts: false,
  });
  const spelling = await fineReadSpelling(row.productId, fineRead);
  await prisma.productBackPhoto.update({
    where: { id: row.id },
    data: {
      analyzedAt: new Date(),
      error: null,
      result: {
        promptVersion: BACK_PHOTO_PROMPT_VERSION,
        source: vision ? "openai" : "local",
        model: vision?.model ?? "local-tesseract",
        ...(vision ? vision.analysis : { labels: localLabels, ingredientsText: fineRead }),
        storedLabels: labels,
        spellingFixed: spelling.fixed,
        spellingSuggestions: spelling.pending,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return { labels, spelling: spelling.pending, fixed: spelling.fixed, vision: Boolean(vision) };
}

export async function runBackPhotoScan(): Promise<JobResult> {
  const startedAt = Date.now();
  const orphans = await settleOrphans();
  const rows = await prisma.productBackPhoto.findMany({
    where: {
      analyzedAt: null,
      productId: { not: null },
      attempts: { lt: MAX_ATTEMPTS },
      step: { in: [...ANALYZED_BACK_PHOTO_STEPS] },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
    select: { id: true, productId: true, step: true, imageUrl: true, attempts: true, localResult: true, localScannedAt: true, createdAt: true },
  });
  let analyzed = 0;
  let failed = 0;
  let labels = 0;
  let spelling = 0;
  let fixed = 0;
  let visionCalls = 0;
  let waiting = 0;
  for (const row of rows) {
    if (!row.productId) continue;
    // Den lokale læsning først; venter billedet stadig på den, tages det næste nat.
    if (!row.localScannedAt && Date.now() - row.createdAt.getTime() < LOCAL_WAIT_MS) {
      waiting += 1;
      continue;
    }
    // Claim: kun én proces tager billedet (forsøget tælles før kaldet).
    const claimed = await prisma.productBackPhoto.updateMany({
      where: { id: row.id, analyzedAt: null, attempts: row.attempts },
      data: { attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const outcome = await analyzePhoto({ id: row.id, productId: row.productId, step: row.step, imageUrl: row.imageUrl, localResult: row.localResult });
      analyzed += 1;
      labels += outcome.labels;
      spelling += outcome.spelling;
      fixed += outcome.fixed;
      if (outcome.vision) visionCalls += 1;
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
    `${analyzed} bagsidebilleder analyseret (${analyzed - visionCalls} lokalt, ${visionCalls} via OpenAI), ${labels} mærkninger gemt, ${fixed} stavefejl rettet, ${spelling} staveforslag` +
    (waiting ? `, ${waiting} venter på lokal læsning` : "") +
    (failed ? `, ${failed} fejl` : "") +
    (orphans.linked ? `, ${orphans.linked} koblet til varen` : "") +
    (orphans.deleted ? `, ${orphans.deleted} uden vare slettet` : "");
  void debugLog({
    category: "cron",
    event: "back_photo_scan",
    message: `Bagsidebilleder: ${message}`,
    durationMs: Date.now() - startedAt,
    data: { analyzed, failed, labels, spelling, fixed, visionCalls, waiting, ...orphans },
  });
  return { message, count: analyzed };
}
