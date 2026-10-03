import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readStoredImageAsDataUrl } from "@/lib/qc-image-storage";
import {
  clearPending,
  enrichQuickProduct,
  retryIngredients,
  type PendingField,
  type QuickEnrichmentInput,
} from "@/lib/quick-product-enrichment";
import { debugLog, errorText, withDebugContext } from "@/lib/debug-log";
import { orderIngredientCandidates } from "@/lib/ingredient-retry-candidates";

// Genoptagelig "opret straks" (docs/DECISIONS.md 2026-10-02).
//
// Baggrundsaflæsningen kører i app-processen via after(). Hvert push til
// master deployer og genstarter appen, og så forsvinder en aflæsning, der
// var i gang: Product.pendingFields blev aldrig ryddet, varesiden viste
// "læses" i det uendelige, og fotoene til energi/indhold var kun gemt, hvis
// OpenAI nåede at svare. Nu gemmes fotos og OCR-tekst ved oprettelsen
// (quick_enrichment_jobs), og jobbet "quick-enrichment-recovery":
//   1. genoptager aflæsninger, der har stået stille i STALE_MINUTES,
//   2. opgiver efter MAX_ATTEMPTS forsøg (rydder pendingFields, logger fejl),
//   3. prøver ingredienslisten igen på de andre fotos fra scanningen, når
//      første aflæsning ikke fandt nogen (glas har tit listen ved stregkoden),
//   4. adopterer ældre varer uden job ud fra de fotos, AI-analyserne gemte.

const STALE_MINUTES = 10;
const MAX_ATTEMPTS = 3;
// Ventetid efter en færdig aflæsning, før ingredienserne prøves igen.
const INGREDIENTS_RETRY_DELAY_MINUTES = 1;
// Ældre varer uden job adopteres kun, hvis de er nyere end dette.
const ADOPT_MAX_AGE_DAYS = 14;
const BATCH_SIZE = 10;

export type QuickEnrichmentStoredInput = {
  barcode: string;
  marketRegion: string;
  signals?: unknown;
  frontPhotoUrl: string | null;
  nutritionPhotoUrl: string | null;
  // null, når ingredienslisten stod på næringsfotoet.
  ingredientsPhotoUrl: string | null;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
  fallbackName: string;
  barcodeAnalysisId?: string | null;
  // Opfyldning af en tynd Open Food Facts-vare: kun registreringer fra og med
  // dette tidspunkt (ISO) regnes om — ældre beholder deres snapshot.
  snapshotsSince?: string;
  // "quick" = gemt ved oprettelsen; "history" = genskabt af AI-analyserne.
  source: "quick" | "history";
};

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

function asStoredInput(value: Prisma.JsonValue): QuickEnrichmentStoredInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as unknown as QuickEnrichmentStoredInput;
  return typeof input.barcode === "string" && typeof input.fallbackName === "string" ? input : null;
}

// Kaldes af POST /api/products/quick lige efter oprettelsen. Aflæsningen
// starter med det samme i after(), så jobbet tæller allerede ét forsøg.
export async function createQuickEnrichmentJob(productId: string, input: QuickEnrichmentStoredInput) {
  await prisma.quickEnrichmentJob.create({
    data: { productId, input: input as unknown as Prisma.InputJsonValue, attempts: 1, startedAt: new Date() },
  });
}

async function markFinished(productId: string, lastError: string | null = null) {
  await prisma.quickEnrichmentJob
    .updateMany({ where: { productId }, data: { finishedAt: new Date(), lastError } })
    .catch((error) => console.error("Could not mark quick enrichment job finished", productId, error));
}

// Første kørsel (after() i ruten), med fotoene stadig i hukommelsen.
export async function runQuickEnrichment(input: QuickEnrichmentInput) {
  try {
    await enrichQuickProduct(input);
    await markFinished(input.productId);
  } catch (error) {
    await prisma.quickEnrichmentJob
      .updateMany({ where: { productId: input.productId }, data: { lastError: errorText(error).slice(0, 1000) } })
      .catch(() => {});
    throw error;
  }
}

async function loadPhoto(url: string | null | undefined): Promise<string | null> {
  return url ? readStoredImageAsDataUrl(url) : null;
}

async function barcodePhotoUrl(barcodeAnalysisId: string | null | undefined): Promise<string | null> {
  if (!barcodeAnalysisId) return null;
  const row = await prisma.aiProductAnalysis.findUnique({ where: { id: barcodeAnalysisId }, select: { imageUrl: true } });
  return row?.imageUrl ?? null;
}

// Genskaber input for en vare uden job ud fra de fotos, AI-analyserne og
// oprettelsen gemte (varer oprettet før quick_enrichment_jobs fandtes).
async function storedInputFromHistory(productId: string): Promise<QuickEnrichmentStoredInput | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      imageUrl: true,
      barcodes: { select: { code: true }, take: 1 },
      aiAnalyses: {
        where: { imageUrl: { not: null } },
        select: { id: true, kind: true, imageUrl: true, marketRegion: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const barcode = product?.barcodes[0]?.code;
  if (!product || !barcode) return null;
  const latest = (kind: string) => product.aiAnalyses.find((row) => row.kind === kind) ?? null;
  const front = latest("FRONT");
  const nutrition = latest("NUTRITION");
  const ingredients = latest("INGREDIENTS");
  const barcodeRow = latest("BARCODE");
  const createdFront = product.imageUrl?.startsWith("/product-images/qc-uploads/") ? product.imageUrl : null;
  return {
    barcode,
    marketRegion: front?.marketRegion ?? nutrition?.marketRegion ?? "DK",
    frontPhotoUrl: front?.imageUrl ?? createdFront,
    nutritionPhotoUrl: nutrition?.imageUrl ?? null,
    ingredientsPhotoUrl: ingredients?.imageUrl && ingredients.imageUrl !== nutrition?.imageUrl ? ingredients.imageUrl : null,
    fallbackName: `Vare ${barcode}`,
    barcodeAnalysisId: barcodeRow?.id ?? null,
    source: "history",
  };
}

// 4. Ældre varer uden job: fastlåste pendingFields, eller (fra kameraflowet)
// ingen ingrediensliste.
async function adoptProductsWithoutJob(now: Date): Promise<number> {
  const since = new Date(now.getTime() - ADOPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const [stuck, missingIngredients] = await Promise.all([
    prisma.product.findMany({
      where: {
        quickEnrichmentJob: { is: null },
        NOT: { pendingFields: { isEmpty: true } },
        createdAt: { gt: since, lt: minutesAgo(now, STALE_MINUTES) },
      },
      select: { id: true, createdAt: true },
      take: BATCH_SIZE,
    }),
    prisma.product.findMany({
      where: {
        quickEnrichmentJob: { is: null },
        pendingFields: { isEmpty: true },
        createdByUserId: { not: null },
        createdAt: { gt: since, lt: minutesAgo(now, INGREDIENTS_RETRY_DELAY_MINUTES) },
        OR: [{ ingredientsText: null }, { ingredientsText: "" }],
        // Kun varer fra kameraflowet: forsiden blev læst af AI.
        aiAnalyses: { some: { kind: "FRONT" } },
      },
      select: { id: true, createdAt: true },
      take: BATCH_SIZE,
    }),
  ]);

  let adopted = 0;
  for (const [product, finished] of [
    ...stuck.map((row) => [row, false] as const),
    ...missingIngredients.map((row) => [row, true] as const),
  ]) {
    const input = await storedInputFromHistory(product.id);
    if (!input) continue;
    const created = await prisma.quickEnrichmentJob
      .create({
        data: {
          productId: product.id,
          input: input as unknown as Prisma.InputJsonValue,
          attempts: 1,
          startedAt: product.createdAt,
          finishedAt: finished ? product.createdAt : null,
        },
      })
      .then(() => true)
      .catch(() => false);
    if (created) adopted += 1;
  }
  return adopted;
}

function toEnrichmentInput(
  productId: string,
  stored: QuickEnrichmentStoredInput,
  photos: { front: string; nutrition: string; ingredients: string | null },
): QuickEnrichmentInput {
  return {
    productId,
    barcode: stored.barcode,
    marketRegion: stored.marketRegion,
    signals: stored.signals,
    frontPhoto: photos.front,
    nutritionPhoto: photos.nutrition,
    ingredientsPhoto: photos.ingredients ?? undefined,
    frontPhotoUrl: stored.frontPhotoUrl,
    nutritionPhotoUrl: stored.nutritionPhotoUrl,
    ingredientsPhotoUrl: stored.ingredientsPhotoUrl,
    nutritionOcrText: stored.nutritionOcrText,
    nutritionOcrConfidence: stored.nutritionOcrConfidence,
    ingredientsOcrText: stored.ingredientsOcrText,
    ingredientsOcrConfidence: stored.ingredientsOcrConfidence,
    fallbackName: stored.fallbackName,
    barcodeAnalysisId: stored.barcodeAnalysisId ?? null,
    snapshotsSince: stored.snapshotsSince ? new Date(stored.snapshotsSince) : undefined,
  };
}

// 1 + 2. Aflæsninger, der har stået stille (processen døde undervejs).
async function resumeStalledJobs(now: Date): Promise<{ resumed: number; givenUp: number }> {
  const jobs = await prisma.quickEnrichmentJob.findMany({
    where: { finishedAt: null, OR: [{ startedAt: null }, { startedAt: { lt: minutesAgo(now, STALE_MINUTES) } }] },
    select: { id: true, productId: true, attempts: true, input: true, product: { select: { pendingFields: true } } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let resumed = 0;
  let givenUp = 0;
  for (const job of jobs) {
    const pending = job.product.pendingFields as PendingField[];
    const debugContext = { productId: job.productId };
    if (pending.length === 0) {
      await markFinished(job.productId);
      continue;
    }
    const stored = asStoredInput(job.input);
    if (!stored || job.attempts >= MAX_ATTEMPTS) {
      await clearPending(job.productId, pending);
      await markFinished(job.productId, stored ? "Opgivet efter flere forsøg" : "Ugyldigt job-input");
      await withDebugContext(debugContext, () =>
        debugLog({
          category: "scan",
          event: "enrichment_recovery",
          level: "error",
          message: `Aflæsningen blev opgivet efter ${job.attempts} forsøg — ventende felter ryddet: ${pending.join(", ")}`,
          data: { attempts: job.attempts, pendingFields: pending },
        }),
      );
      givenUp += 1;
      continue;
    }

    // Claim: kun én proces genoptager samme job.
    const claimed = await prisma.quickEnrichmentJob.updateMany({
      where: { id: job.id, attempts: job.attempts, finishedAt: null },
      data: { attempts: job.attempts + 1, startedAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const wantFront = pending.includes("name") || pending.includes("brand");
    const wantLabel = pending.includes("nutrition") || pending.includes("ingredients");
    const [front, nutrition, ingredients] = await Promise.all([
      loadPhoto(stored.frontPhotoUrl),
      loadPhoto(stored.nutritionPhotoUrl),
      loadPhoto(stored.ingredientsPhotoUrl),
    ]);
    // Uden foto kan delen ikke læses igen; dens felter ryddes, så siden
    // ikke venter for evigt.
    const missing: PendingField[] = [];
    if (wantFront && !front) missing.push("name", "brand");
    if (wantLabel && !nutrition) missing.push("nutrition", "ingredients");
    if (missing.length) await clearPending(job.productId, missing);
    const parts = { front: wantFront && Boolean(front), label: wantLabel && Boolean(nutrition) };

    await withDebugContext({ ...debugContext, barcode: stored.barcode }, async () => {
      await debugLog({
        category: "scan",
        event: "enrichment_recovery",
        level: "warn",
        message: `Aflæsningen stod stille — genoptager (forsøg ${job.attempts + 1}): ${pending.join(", ")}${
          missing.length ? ` · intet foto til ${missing.join(", ")}` : ""
        }`,
        data: { pendingFields: pending, parts, missing, source: stored.source },
      });
      if (!parts.front && !parts.label) {
        await markFinished(job.productId, "Ingen gemte fotos at genoptage fra");
        return;
      }
      try {
        await enrichQuickProduct(
          toEnrichmentInput(job.productId, stored, {
            front: front ?? "",
            nutrition: nutrition ?? "",
            ingredients,
          }),
          parts,
        );
        await markFinished(job.productId);
      } catch (error) {
        await prisma.quickEnrichmentJob
          .update({ where: { id: job.id }, data: { lastError: errorText(error).slice(0, 1000) } })
          .catch(() => {});
      }
    });
    resumed += 1;
  }
  return { resumed, givenUp };
}

// 3. Ingen ingrediensliste efter første aflæsning: prøv de andre fotos fra
// scanningen, ét pr. kørsel (rækkefølge: src/lib/ingredient-retry-candidates.ts).
async function ingredientCandidates(stored: QuickEnrichmentStoredInput) {
  return orderIngredientCandidates({
    barcodePhotoUrl: await barcodePhotoUrl(stored.barcodeAnalysisId),
    nutritionPhotoUrl: stored.nutritionPhotoUrl,
    ingredientsPhotoUrl: stored.ingredientsPhotoUrl,
    nutritionOcrText: stored.nutritionOcrText,
    ingredientsOcrText: stored.ingredientsOcrText,
  });
}

async function retryMissingIngredients(now: Date): Promise<{ tried: number; found: number }> {
  const jobs = await prisma.quickEnrichmentJob.findMany({
    where: {
      finishedAt: { not: null, lt: minutesAgo(now, INGREDIENTS_RETRY_DELAY_MINUTES) },
      ingredientsRetries: { lt: 3 },
      product: { pendingFields: { isEmpty: true }, OR: [{ ingredientsText: null }, { ingredientsText: "" }] },
    },
    select: { id: true, productId: true, input: true, ingredientsRetries: true },
    orderBy: { finishedAt: "asc" },
    take: BATCH_SIZE,
  });

  let tried = 0;
  let found = 0;
  for (const job of jobs) {
    const stored = asStoredInput(job.input);
    const candidates = stored ? await ingredientCandidates(stored) : [];
    const candidate = candidates[job.ingredientsRetries];
    // Ingen flere fotos at prøve: markér jobbet udtømt.
    const claimed = await prisma.quickEnrichmentJob.updateMany({
      where: { id: job.id, ingredientsRetries: job.ingredientsRetries },
      data: { ingredientsRetries: candidate ? job.ingredientsRetries + 1 : 3 },
    });
    if (claimed.count !== 1 || !candidate || !stored) continue;

    const photo = await loadPhoto(candidate.url);
    if (!photo) continue;
    tried += 1;
    const ok = await withDebugContext({ productId: job.productId, barcode: stored.barcode }, () =>
      retryIngredients({
        productId: job.productId,
        barcode: stored.barcode,
        marketRegion: stored.marketRegion,
        signals: stored.signals,
        photo,
        photoUrl: candidate.url,
        photoLabel: candidate.label,
        ocrText: candidate.ocrText,
      }),
    ).catch(() => false);
    if (ok) found += 1;
  }
  return { tried, found };
}

// Job "quick-enrichment-recovery" (src/lib/jobs/registry.ts).
export async function recoverQuickEnrichments(now: Date = new Date()): Promise<string | null> {
  const adopted = await adoptProductsWithoutJob(now);
  const { resumed, givenUp } = await resumeStalledJobs(now);
  const { tried, found } = await retryMissingIngredients(now);
  if (!adopted && !resumed && !givenUp && !tried) return null;
  return `Adopteret ${adopted} · genoptaget ${resumed} · opgivet ${givenUp} · ingrediens-forsøg ${tried} (fundet ${found})`;
}
