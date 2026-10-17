import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readStoredImageAsDataUrl } from "@/lib/qc-image-storage";
import {
  applyEanReserve,
  applyFrontTextFromServerOcr,
  applyServerNutritionOcr,
  clearPending,
  enrichQuickProduct,
  retryIngredients,
  type PendingField,
  type QuickEnrichmentInput,
  type QuickEnrichmentRetry,
} from "@/lib/quick-product-enrichment";
import { createFallbackFrontCutoutJob } from "@/lib/image-cutout-jobs";
import { debugLog, errorText, withDebugContext } from "@/lib/debug-log";
import { orderIngredientCandidates } from "@/lib/ingredient-retry-candidates";
import { probeKeyStatus } from "@/lib/openai-usage";

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
  // Kameraflowets id: bagsidebilleder, der uploades efter oprettelsen, finder
  // varen gennem det (src/lib/product-back-photos.ts).
  flowId?: string;
  barcode: string;
  marketRegion: string;
  signals?: unknown;
  frontPhotoUrl: string | null;
  nutritionPhotoUrl: string | null;
  // null, når ingredienslisten stod på næringsfotoet.
  ingredientsPhotoUrl: string | null;
  frontOcrText?: string;
  nutritionAnalysisId?: string | null;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
  fallbackName: string;
  barcodeAnalysisId?: string | null;
  // "quick" = gemt ved oprettelsen; "history" = genskabt af AI-analyserne.
  source: "quick" | "history";
  // Dele, hvor OpenAI-kaldet fejlede teknisk, og som prøves igen, selv om
  // felterne er ryddet (docs/DECISIONS.md 2026-10-16).
  retryParts?: RetryPart[];
  // Originalbilleder, serverens lokale tekstlæsning allerede er prøvet på.
  localTried?: string[];
  // Engangsreparationen af varer, der blev færdige uden navn/energi.
  repairedAt?: string;
  // Reparationsrunde: runde 1 kørte, mens OpenAI-kreditten var tom, og brændte
  // forsøgene af; runde 2 læste kun forsiden igen ved tomt navn. Varer under
  // REPAIR_ROUND genåbnes én gang til.
  repairRound?: number;
  // Stregkode-reserven er prøvet (src/lib/ean-reserve-match.ts) — én gang pr. vare.
  eanReserveAt?: string;
};

const REPAIR_ROUND = 3;

type RetryPart = "front" | "label";

function retryPartsOf(retry: QuickEnrichmentRetry): RetryPart[] {
  return [...(retry.front ? (["front"] as const) : []), ...(retry.label ? (["label"] as const) : [])];
}

// En aflæsning med teknisk fejl: jobbet åbnes igen og genoptages efter
// STALE_MINUTES (resumeStalledJobs), højst MAX_ATTEMPTS forsøg i alt.
async function scheduleRetry(productId: string, parts: RetryPart[]) {
  const job = await prisma.quickEnrichmentJob.findUnique({ where: { productId }, select: { input: true } });
  const stored = job ? asStoredInput(job.input) : null;
  if (!stored) return;
  await prisma.quickEnrichmentJob.update({
    where: { productId },
    data: {
      input: { ...stored, retryParts: parts } as unknown as Prisma.InputJsonValue,
      finishedAt: null,
      startedAt: new Date(),
      lastError: `Teknisk fejl i AI-aflæsningen — prøves igen: ${parts.join(", ")}`,
    },
  });
}

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
    const parts = retryPartsOf(await enrichQuickProduct(input));
    if (parts.length) await scheduleRetry(input.productId, parts);
    else await markFinished(input.productId);
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
    // Navnet, hvis forsiden intet giver, er brand + subbrand (enrichFront).
    fallbackName: "",
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
    frontOcrText: stored.frontOcrText,
    nutritionAnalysisId: stored.nutritionAnalysisId ?? null,
    nutritionOcrText: stored.nutritionOcrText,
    nutritionOcrConfidence: stored.nutritionOcrConfidence,
    ingredientsOcrText: stored.ingredientsOcrText,
    ingredientsOcrConfidence: stored.ingredientsOcrConfidence,
    fallbackName: stored.fallbackName,
    barcodeAnalysisId: stored.barcodeAnalysisId ?? null,
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
    const stored = asStoredInput(job.input);
    const retryParts = stored?.retryParts ?? [];
    if (pending.length === 0 && retryParts.length === 0) {
      await markFinished(job.productId);
      continue;
    }
    if (!stored || job.attempts >= MAX_ATTEMPTS) {
      if (pending.length) await clearPending(job.productId, pending);
      // Forsiden blev aldrig læst af AI'en, så der kom intet fritlægningsjob:
      // hele forsidefotoet fritlægges i stedet (brugerens krav 2026-10-16).
      if (stored && retryParts.includes("front")) {
        await createFallbackFrontCutoutJob(job.productId, stored.frontPhotoUrl).catch((error) =>
          console.error("Could not queue fallback cutout", job.productId, error),
        );
      }
      await markFinished(job.productId, stored ? "Opgivet efter flere forsøg" : "Ugyldigt job-input");
      await withDebugContext(debugContext, () =>
        debugLog({
          category: "scan",
          event: "enrichment_recovery",
          level: "error",
          message: `Aflæsningen blev opgivet efter ${job.attempts} forsøg — ${[
            pending.length ? `ventende felter ryddet: ${pending.join(", ")}` : "",
            retryParts.length ? `AI-aflæsning fejlede stadig: ${retryParts.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}`,
          data: { attempts: job.attempts, pendingFields: pending, retryParts },
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

    const wantFront = pending.includes("name") || pending.includes("brand") || retryParts.includes("front");
    const wantLabel = pending.includes("nutrition") || pending.includes("ingredients") || retryParts.includes("label");
    const [front, nutrition, ingredients] = await Promise.all([
      loadPhoto(stored.frontPhotoUrl),
      loadPhoto(stored.nutritionPhotoUrl),
      loadPhoto(stored.ingredientsPhotoUrl),
    ]);
    // Uden foto kan delen ikke læses igen; dens felter ryddes, så siden
    // ikke venter for evigt.
    const missing: PendingField[] = [];
    if (wantFront && !front) missing.push("name", "brand");
    // Energi kan være sprunget over i flowet; så læses indholdsfotoet alene.
    const labelPhoto = Boolean(nutrition || ingredients);
    if (wantLabel && !labelPhoto) missing.push("nutrition", "ingredients");
    if (missing.length) await clearPending(job.productId, missing);
    const parts = { front: wantFront && Boolean(front), label: wantLabel && labelPhoto };

    await withDebugContext({ ...debugContext, barcode: stored.barcode }, async () => {
      await debugLog({
        category: "scan",
        event: "enrichment_recovery",
        level: "warn",
        message: `${retryParts.length ? "AI-aflæsningen fejlede — prøver igen" : "Aflæsningen stod stille — genoptager"} (forsøg ${job.attempts + 1}): ${[...pending, ...retryParts].join(", ")}${
          missing.length ? ` · intet foto til ${missing.join(", ")}` : ""
        }`,
        data: { pendingFields: pending, retryParts, parts, missing, source: stored.source },
      });
      if (!parts.front && !parts.label) {
        await markFinished(job.productId, "Ingen gemte fotos at genoptage fra");
        return;
      }
      try {
        const again = retryPartsOf(
          await enrichQuickProduct(
            toEnrichmentInput(job.productId, stored, {
              front: front ?? "",
              nutrition: nutrition ?? "",
              ingredients,
            }),
            // Stregkode-logoet blev læst ved første forsøg.
            { ...parts, barcodeLogo: retryParts.length === 0 },
          ),
        );
        if (again.length) {
          await prisma.quickEnrichmentJob.update({
            where: { id: job.id },
            data: {
              input: { ...stored, retryParts: again } as unknown as Prisma.InputJsonValue,
              lastError: `Teknisk fejl i AI-aflæsningen — prøves igen: ${again.join(", ")}`,
            },
          });
        } else {
          if (retryParts.length) {
            await prisma.quickEnrichmentJob.update({
              where: { id: job.id },
              data: { input: { ...stored, retryParts: [] } as unknown as Prisma.InputJsonValue },
            });
          }
          await markFinished(job.productId);
        }
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

// 5. Engangsreparation (docs/DECISIONS.md 2026-10-16): varer, hvis aflæsning
// blev "færdig" uden navn eller uden energi, fordi OpenAI-kaldet fejlede, før
// genforsøgene fandtes (fx Änglamark-letmælken). Jobbet åbnes igen med de
// dele, der mangler, og genoptages straks. Forsiden læses igen, når AI'en
// aldrig har læst den (ingen FRONT-analyse) — også selv om den lokale
// tekstlæsning har givet et navn: ellers mangler brand og fritlægning.
async function reopenBrokenProducts(now: Date): Promise<number> {
  const since = new Date(now.getTime() - ADOPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await prisma.quickEnrichmentJob.findMany({
    where: {
      finishedAt: { not: null },
      product: {
        createdAt: { gt: since },
        pendingFields: { isEmpty: true },
        OR: [{ name: "" }, { kcalPer100g: 0 }, { aiAnalyses: { none: { kind: "FRONT" } } }],
      },
    },
    select: {
      id: true,
      input: true,
      product: {
        select: {
          name: true,
          kcalPer100g: true,
          _count: { select: { aiAnalyses: { where: { kind: "FRONT" } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    // Allerede reparerede springes over herunder.
    take: 300,
  });
  let reopened = 0;
  for (const job of jobs) {
    const stored = asStoredInput(job.input);
    if (!stored || (stored.repairRound ?? (stored.repairedAt ? 1 : 0)) >= REPAIR_ROUND) continue;
    const parts: RetryPart[] = [];
    const frontNeverRead = job.product._count.aiAnalyses === 0;
    if (stored.frontPhotoUrl && (!job.product.name.trim() || frontNeverRead)) parts.push("front");
    if (stored.nutritionPhotoUrl && job.product.kcalPer100g === 0) parts.push("label");
    const input = { ...stored, repairedAt: now.toISOString(), repairRound: REPAIR_ROUND, retryParts: parts };
    await prisma.quickEnrichmentJob.update({
      where: { id: job.id },
      data: parts.length
        ? {
            input: input as unknown as Prisma.InputJsonValue,
            finishedAt: null,
            attempts: 1,
            // Genoptages i samme kørsel (resumeStalledJobs).
            startedAt: minutesAgo(now, STALE_MINUTES + 1),
            lastError: `Genåbnet: ${parts.join(", ")} manglede`,
          }
        : { input: input as unknown as Prisma.InputJsonValue },
    });
    if (parts.length) reopened += 1;
  }
  return reopened;
}

// 0. Lokal genlæsning (brugerens krav 2026-10-16): nye varer uden navn eller
// energi rettes ud fra serverens egen tekstlæsning af de gemte billeder
// (quality-control-agent back_local.py, tesseract i fuld opløsning) — uden
// OpenAI, så det virker også, mens kreditten er tom. Mangler et billede i
// originalarkivet (varer fra før arkivet), lægges de gemte fotos ind, så den
// lokale læser tager dem. Hvert billede prøves én gang (localTried).
type LocalResult = { text?: unknown; confidence?: unknown };

async function repairFromServerText(now: Date): Promise<{ named: number; nutrition: number; queued: number }> {
  const since = new Date(now.getTime() - ADOPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await prisma.quickEnrichmentJob.findMany({
    where: {
      product: { createdAt: { gt: since }, pendingFields: { isEmpty: true }, OR: [{ name: "" }, { kcalPer100g: 0 }] },
    },
    select: { id: true, productId: true, input: true, product: { select: { name: true, kcalPer100g: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  let named = 0;
  let nutrition = 0;
  let queued = 0;
  for (const job of jobs) {
    const stored = asStoredInput(job.input);
    if (!stored) continue;
    const needName = !job.product.name.trim();
    const needNutrition = job.product.kcalPer100g === 0;
    const photos = await prisma.productBackPhoto.findMany({
      where: { productId: job.productId },
      select: { id: true, step: true, imageUrl: true, localResult: true },
      orderBy: { createdAt: "asc" },
    });
    // Billeder, der mangler i arkivet, lægges ind til den lokale læser.
    const wanted: [string, string | null, boolean][] = [
      ["front", stored.frontPhotoUrl, needName],
      ["nutrition", stored.nutritionPhotoUrl, needNutrition],
      ["ingredients", stored.ingredientsPhotoUrl, needNutrition],
    ];
    for (const [step, url, need] of wanted) {
      if (!need || !url || photos.some((photo) => photo.step === step)) continue;
      await prisma.productBackPhoto.create({
        data: { productId: job.productId, step, imageUrl: url, flowId: stored.flowId ?? `job-${job.id}` },
      });
      queued += 1;
    }
    const tried = new Set(stored.localTried ?? []);
    const fresh = photos.filter((photo) => !tried.has(photo.id) && photo.localResult);
    for (const photo of fresh) {
      const local = photo.localResult as LocalResult;
      const text = typeof local.text === "string" ? local.text : "";
      const confidence = typeof local.confidence === "number" ? local.confidence : 0;
      tried.add(photo.id);
      if (!text) continue;
      await withDebugContext({ productId: job.productId, barcode: stored.barcode }, async () => {
        if (needNutrition && (photo.step === "nutrition" || photo.step === "ingredients")) {
          const ok = await applyServerNutritionOcr({
            productId: job.productId,
            barcode: stored.barcode,
            marketRegion: stored.marketRegion,
            signals: stored.signals,
            text,
            confidence,
            imageUrl: photo.imageUrl,
          }).catch(() => false);
          if (ok) nutrition += 1;
        }
        if (needName && photo.step === "front") {
          const ok = await applyFrontTextFromServerOcr(job.productId, text).catch(() => false);
          if (ok) named += 1;
        }
      });
    }
    if (fresh.length) {
      await prisma.quickEnrichmentJob.update({
        where: { id: job.id },
        data: { input: { ...stored, localTried: [...tried] } as unknown as Prisma.InputJsonValue },
      });
    }
  }
  return { named, nutrition, queued };
}

// Stregkode-reserven (brugerens valg 2026-10-17): varer, der stadig mangler
// energi eller navn, når billederne er læst (jobbet er færdigt eller varen er
// over 10 minutter gammel), prøves én gang mod stregkodeopslaget. Bruger ikke
// OpenAI. Etikettens energital kommer fra telefonens og serverens tekstlæsning.
const EAN_RESERVE_AFTER_MS = 10 * 60 * 1000;

async function repairFromEanReserve(now: Date): Promise<{ tried: number; nutrition: number; named: number }> {
  const since = new Date(now.getTime() - ADOPT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const settled = new Date(now.getTime() - EAN_RESERVE_AFTER_MS);
  const jobs = await prisma.quickEnrichmentJob.findMany({
    where: {
      OR: [{ finishedAt: { not: null } }, { createdAt: { lt: settled } }],
      product: { createdAt: { gt: since }, pendingFields: { isEmpty: true }, OR: [{ name: "" }, { kcalPer100g: 0 }] },
    },
    select: { id: true, productId: true, input: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  let tried = 0;
  let nutrition = 0;
  let named = 0;
  for (const job of jobs) {
    const stored = asStoredInput(job.input);
    if (!stored || stored.eanReserveAt || !stored.barcode) continue;
    const photos = await prisma.productBackPhoto.findMany({
      where: { productId: job.productId },
      select: { step: true, localResult: true },
    });
    const textOf = (step: string) =>
      photos
        .filter((photo) => photo.step === step)
        .map((photo) => (photo.localResult as LocalResult | null)?.text)
        .filter((text): text is string => typeof text === "string");
    const result = await withDebugContext({ productId: job.productId, barcode: stored.barcode }, () =>
      applyEanReserve({
        productId: job.productId,
        barcode: stored.barcode,
        labelTexts: [stored.nutritionOcrText, stored.ingredientsOcrText, ...textOf("nutrition"), ...textOf("ingredients")],
        frontTexts: [stored.frontOcrText, stored.fallbackName, ...textOf("front")],
      }),
    ).catch((error) => {
      console.error("[quick-enrichment] stregkode-reserve fejlede", job.productId, error);
      return null;
    });
    if (!result) continue;
    tried += 1;
    if (result.nutrition) nutrition += 1;
    if (result.name) named += 1;
    await prisma.quickEnrichmentJob.update({
      where: { id: job.id },
      data: { input: { ...stored, eanReserveAt: now.toISOString() } as unknown as Prisma.InputJsonValue },
    });
  }
  return { tried, nutrition, named };
}

// Job "quick-enrichment-recovery" (src/lib/jobs/registry.ts).
export async function recoverQuickEnrichments(now: Date = new Date()): Promise<string | null> {
  // Lokal genlæsning først — den kræver ikke OpenAI.
  const local = await repairFromServerText(now);
  const reserve = await repairFromEanReserve(now);
  const localNote =
    [
      local.named || local.nutrition || local.queued
        ? `Lokalt: navn ${local.named} · energi ${local.nutrition} · billeder sat i kø ${local.queued}`
        : "",
      reserve.tried ? `Stregkode-reserve: ${reserve.tried} prøvet · energi ${reserve.nutrition} · navn ${reserve.named}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || null;
  // Uden OpenAI-kredit (eller med afvist/manglende nøgle) fejler hvert forsøg:
  // jobbene står stille i stedet for at brænde forsøgene af og blive opgivet.
  // De gemte fotos læses, så snart kreditten er tilbage (bruger 2026-10-16).
  const ai = await probeKeyStatus();
  if (ai.state === "quota" || ai.state === "invalid" || ai.state === "missing") {
    return `${localNote ? `${localNote} · ` : ""}Venter på OpenAI (${ai.state}) — ingen AI-aflæsninger prøvet`;
  }
  const reopened = await reopenBrokenProducts(now);
  const adopted = await adoptProductsWithoutJob(now);
  const { resumed, givenUp } = await resumeStalledJobs(now);
  const { tried, found } = await retryMissingIngredients(now);
  if (!reopened && !adopted && !resumed && !givenUp && !tried) return localNote;
  return `${localNote ? `${localNote} · ` : ""}Genåbnet ${reopened} · adopteret ${adopted} · genoptaget ${resumed} · opgivet ${givenUp} · ingrediens-forsøg ${tried} (fundet ${found})`;
}
