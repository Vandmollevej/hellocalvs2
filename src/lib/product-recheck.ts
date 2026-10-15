import { readFile } from "fs/promises";
import path from "path";
import type { Prisma, ProductRecheckStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callStructuredVision } from "@/lib/product-ai";
import { readStoredImageAsDataUrl, saveDataUrlImage } from "@/lib/qc-image-storage";
import { analyzeIngredientsPhoto, analyzeLabelPhoto, analyzeNutritionPhoto } from "@/lib/product-photo-analysis";
import { localIngredients, localNutrition } from "@/lib/local-label";
import { loadSpellingDictionary } from "@/lib/spelling-dictionary";
import { discardPendingFrontImage } from "@/lib/image-cutout-jobs";
import { resolveCroppedFront } from "@/lib/front-image-check";
import { debugLog, errorText } from "@/lib/debug-log";
import type { ImageBox } from "@/lib/product-analysis-types";
import {
  RECHECK_NUTRITION_FIELDS,
  changedRecheckFields,
  isRecheckDue,
  registrationMacros,
  type RecheckField,
  type RecheckNutritionField,
  type RecheckValues,
} from "@/lib/product-recheck-rules";

// 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15).
//
// 1. Scanning: en vare, der har ligget i databasen i over to år, fremstår som
//    ny (opslaget svarer `qualityCheck: true`), og kameraet tager forside,
//    energi og indhold. Kunden får varens tidligere info med det samme; fotoene
//    gemmes kun (submitProductRecheck) — ingen AI i dagtimerne.
// 2. Natten (jobbet "product-recheck"): AI'en sammenligner det nye forsidefoto
//    med originalen (ændret grafik, eller er det nye foto bedre?) og læser
//    energi/indhold (telefonens OCR først). Intet ændret → lukket. Ændret →
//    admin → Nye varer → 2-års tjek. Registreringer fra og med scanningen
//    (kunden selv og dem imellem) får de nye tal; ældre historik røres aldrig.
// 3. Admin ser det nye foto ved siden af originalen (det nye er valgt som
//    standard) og tager stilling, FØR billedet fritlægges, så der ikke bruges
//    tokens/robottid på et billede, der ikke skal bruges.
// 4. Natten efter: det valgte foto fritlægges og sættes på varen.

const OPEN_STATUSES: ProductRecheckStatus[] = ["SUBMITTED", "AWAITING_ADMIN", "APPROVED"];
// Højst så mange vurderinger pr. nat (to små AI-kald hver).
const NIGHT_BATCH = 40;
// Billedrobotten tjekker hvert 15. sekund; så længe ventes der på fritlægningerne.
const CUTOUT_WAIT_MS = 3 * 60_000;
const CUTOUT_POLL_MS = 15_000;

const PRODUCT_RECHECK_SELECT = {
  createdAt: true,
  qualityCheckedAt: true,
  privateOwnerId: true,
  discontinued: true,
  deletedAt: true,
  status: true,
  pendingFields: true,
} as const;

// Skal varen fremstå som ny ved denne scanning? Kun når den er over to år, og
// der ikke allerede ligger et åbent tjek (så scanner de næste kunder normalt).
export async function isProductRecheckDue(productId: string, now: Date = new Date()): Promise<boolean> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: PRODUCT_RECHECK_SELECT });
  if (!product || !isRecheckDue(product, now)) return false;
  const open = await prisma.productRecheck.count({ where: { productId, status: { in: OPEN_STATUSES } } });
  return open === 0;
}

export type RecheckSubmission = {
  productId: string;
  userId: string;
  marketRegion: string;
  signals?: unknown;
  frontPhoto: string;
  nutritionPhoto?: string;
  ingredientsPhoto?: string;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
};

// Gemmer kun fotoene og varen, som den er nu. Returnerer null, hvis varen ikke
// (længere) skal tjekkes — fx fordi en anden kunde netop har sendt fotos.
export async function submitProductRecheck(input: RecheckSubmission): Promise<string | null> {
  if (!(await isProductRecheckDue(input.productId))) return null;
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      name: true,
      imageUrl: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      ingredientsText: true,
    },
  });
  if (!product) return null;
  const [frontPhotoUrl, nutritionPhotoUrl, ingredientsPhotoUrl] = await Promise.all([
    saveDataUrlImage(input.frontPhoto),
    input.nutritionPhoto ? saveDataUrlImage(input.nutritionPhoto).catch(() => null) : Promise.resolve(null),
    input.ingredientsPhoto ? saveDataUrlImage(input.ingredientsPhoto).catch(() => null) : Promise.resolve(null),
  ]);
  if (!frontPhotoUrl) return null;
  const original: RecheckValues = {
    name: product.name,
    kcalPer100g: product.kcalPer100g,
    proteinPer100g: product.proteinPer100g,
    carbsPer100g: product.carbsPer100g,
    fatPer100g: product.fatPer100g,
    ingredientsText: product.ingredientsText,
  };
  const recheck = await prisma.productRecheck.create({
    data: {
      productId: input.productId,
      userId: input.userId,
      marketRegion: input.marketRegion,
      signals: (input.signals ?? undefined) as Prisma.InputJsonValue | undefined,
      frontPhotoUrl,
      nutritionPhotoUrl,
      ingredientsPhotoUrl,
      nutritionOcrText: input.nutritionOcrText || null,
      nutritionOcrConfidence: input.nutritionOcrConfidence ?? null,
      ingredientsOcrText: input.ingredientsOcrText || null,
      ingredientsOcrConfidence: input.ingredientsOcrConfidence ?? null,
      originalImageUrl: product.imageUrl,
      original: original as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return recheck.id;
}

// ---------------------------------------------------------------------------
// Natten: AI-vurdering

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// Varens nuværende billede til AI'en: en offentlig https-adresse sendes som
// den er; vores egne filer (fritlagte PNG'er, kamerafotos) læses fra disken.
async function imageForAi(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  const clean = url.split(/[?#]/)[0];
  const stored = await readStoredImageAsDataUrl(clean);
  if (stored) return stored;
  if (!clean.startsWith("/product-images/")) return null;
  const root = path.join(process.cwd(), "public", "product-images");
  const file = path.resolve(root, clean.slice("/product-images/".length));
  const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(root + path.sep)) return null;
  const buffer = await readFile(file).catch(() => null);
  return buffer ? `data:${type};base64,${buffer.toString("base64")}` : null;
}

const BOX_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

const COMPARE_SCHEMA = {
  type: "object",
  properties: {
    sameProduct: { type: "boolean" },
    designChanged: { type: "boolean" },
    newPhotoBetter: { type: "boolean" },
    differences: { type: "string" },
    productBox: BOX_SCHEMA,
  },
  required: ["sameProduct", "designChanged", "newPhotoBetter", "differences", "productBox"],
  additionalProperties: false,
};

const COMPARE_SYSTEM = `Du kvalitetstjekker et produktbillede i en dansk kalorietæller.
Billede 1 er varens nuværende billede i databasen (ofte fritlagt på hvid/gennemsigtig baggrund).
Billede 2 er et nyt foto af samme vares forside, taget af en kunde i dag med mobilen.
Svar:
- sameProduct: er det samme vare (samme brand og produkttype), også selv om emballagen er redesignet?
- designChanged: er emballagens design ændret — nyt logo, nye farver, ny grafik, ny tekst/claims, ny form eller ny pakningsstørrelse? Ignorér baggrund, lys, vinkel, refleksioner, skarphed og fritlægning.
- newPhotoBetter: viser det nye foto varen tydeligt bedre end det nuværende billede (det nuværende er fx sløret, beskåret, lille eller af en anden variant)?
- differences: kort på dansk, hvad der er ændret eller hvorfor det nye er bedre (tom streng, hvis intet).
- productBox: varen på billede 2 i 0-1 af billedets bredde/højde, eller null.`;

type FrontCompare = {
  sameProduct: boolean;
  designChanged: boolean;
  newPhotoBetter: boolean;
  differences: string;
  productBox: ImageBox | null;
};

function cleanBox(box: ImageBox | null): ImageBox | null {
  if (!box) return null;
  const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const x = clamp(box.x);
  const y = clamp(box.y);
  const width = clamp(Math.min(box.width, 1 - x));
  const height = clamp(Math.min(box.height, 1 - y));
  return width > 0.05 && height > 0.05 ? { x, y, width, height } : null;
}

async function compareFront(recheck: { frontPhotoUrl: string; originalImageUrl: string | null }) {
  const photo = await readStoredImageAsDataUrl(recheck.frontPhotoUrl);
  if (!photo) throw new Error("Det nye forsidefoto findes ikke på disken");
  const original = await imageForAi(recheck.originalImageUrl);
  if (!original) {
    return {
      changed: true,
      note: recheck.originalImageUrl ? "Det nuværende billede kunne ikke indlæses" : "Varen havde intet billede",
      productBox: null,
    };
  }
  // Lav detaljegrad: grafik og farver ses fint i lille størrelse og koster en brøkdel.
  const { value } = await callStructuredVision<FrontCompare>({
    photo: original,
    extraPhotos: [photo],
    detail: "low",
    system: COMPARE_SYSTEM,
    text: "Billede 1: nuværende billede. Billede 2: nyt foto fra kunden.",
    schemaName: "hello_cal_recheck_front",
    schema: COMPARE_SCHEMA,
  });
  const reasons = [
    !value.sameProduct ? "ligner en anden vare" : null,
    value.designChanged ? "ny emballage/grafik" : null,
    value.newPhotoBetter ? "det nye foto er bedre" : null,
  ].filter(Boolean);
  const note = [reasons.join(", "), value.differences.trim()].filter(Boolean).join(" — ") || "Ingen ændringer i billedet";
  return {
    changed: !value.sameProduct || value.designChanged || value.newPhotoBetter,
    note,
    productBox: cleanBox(value.productBox),
  };
}

type Recheck = Prisma.ProductRecheckGetPayload<{ include: { product: { select: { barcodes: { select: { code: true } } } } } }>;

// Energi og indhold: telefonens egen aflæsning, når den er sikker, ellers ét
// AI-kald (samlet, hvis indholdet stod på energifotoet). Analyserne kobles
// ikke til varen, så de ikke havner på Usikkerheder.
async function readLabels(recheck: Recheck): Promise<RecheckValues> {
  const values: RecheckValues = { kcalPer100g: null, proteinPer100g: null, carbsPer100g: null, fatPer100g: null, ingredientsText: null };
  if (!recheck.nutritionPhotoUrl) return values;
  const base = {
    barcode: recheck.product.barcodes[0]?.code ?? "",
    marketRegion: recheck.marketRegion,
    signals: recheck.signals ?? undefined,
  };
  const nutritionText = recheck.nutritionOcrText ?? "";
  const ingredientsText = recheck.ingredientsPhotoUrl ? (recheck.ingredientsOcrText ?? "") : nutritionText;
  const ingredientsConfidence = recheck.ingredientsPhotoUrl ? recheck.ingredientsOcrConfidence : recheck.nutritionOcrConfidence;
  let nutrition = localNutrition(nutritionText, recheck.nutritionOcrConfidence ?? 0);
  let ingredients = localIngredients(ingredientsText, ingredientsConfidence ?? 0, await loadSpellingDictionary());

  if (!nutrition || (!ingredients && !recheck.ingredientsPhotoUrl)) {
    const photo = await readStoredImageAsDataUrl(recheck.nutritionPhotoUrl);
    if (photo && !nutrition && !recheck.ingredientsPhotoUrl) {
      const both = await analyzeLabelPhoto({ ...base, photo, ocrText: nutritionText, storedImageUrl: recheck.nutritionPhotoUrl });
      nutrition = both.nutrition.result;
      if (both.ingredients.result.ingredientsText || !ingredients) ingredients = both.ingredients.result;
    } else if (photo && !nutrition) {
      nutrition = (await analyzeNutritionPhoto({ ...base, photo, ocrText: nutritionText, storedImageUrl: recheck.nutritionPhotoUrl })).result;
    }
  }
  if (!ingredients && recheck.ingredientsPhotoUrl) {
    const photo = await readStoredImageAsDataUrl(recheck.ingredientsPhotoUrl);
    if (photo) {
      ingredients = (
        await analyzeIngredientsPhoto({ ...base, photo, ocrText: ingredientsText, storedImageUrl: recheck.ingredientsPhotoUrl })
      ).result;
    }
  }
  if (nutrition) {
    values.kcalPer100g = nutrition.kcalPer100g;
    values.proteinPer100g = nutrition.proteinPer100g;
    values.carbsPer100g = nutrition.carbsPer100g;
    values.fatPer100g = nutrition.fatPer100g;
  }
  values.ingredientsText = ingredients?.ingredientsText?.trim() || null;
  return values;
}

function asValues(value: Prisma.JsonValue | null): RecheckValues {
  const record = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const num = (key: string) => (typeof record[key] === "number" ? (record[key] as number) : null);
  return {
    name: typeof record.name === "string" ? record.name : null,
    kcalPer100g: num("kcalPer100g"),
    proteinPer100g: num("proteinPer100g"),
    carbsPer100g: num("carbsPer100g"),
    fatPer100g: num("fatPer100g"),
    ingredientsText: typeof record.ingredientsText === "string" ? record.ingredientsText : null,
  };
}

function nutritionChangedFields(fields: string[]): RecheckNutritionField[] {
  return RECHECK_NUTRITION_FIELDS.filter((field) => fields.includes(field));
}

// Registreringer fra og med scanningen (kunden selv og dem, der har tilføjet
// varen siden) får næringen; ældre registreringer beholder deres snapshot.
async function refreshRegistrationsSince(productId: string, since: Date, values: Record<RecheckNutritionField, number>) {
  const registrations = await prisma.registration.findMany({
    where: { productId, createdAt: { gte: since } },
    select: { id: true, amountGrams: true },
  });
  for (const registration of registrations) {
    await prisma.registration.update({
      where: { id: registration.id },
      data: registrationMacros(values, registration.amountGrams),
    });
  }
  return registrations.length;
}

async function currentNutrition(productId: string): Promise<Record<RecheckNutritionField, number> | null> {
  return prisma.product.findUnique({
    where: { id: productId },
    select: { kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
}

// Varens næring med de aflæste tal i de ændrede felter.
function withReadValues(base: Record<RecheckNutritionField, number>, read: RecheckValues, fields: RecheckNutritionField[]) {
  const merged = { ...base };
  for (const field of fields) {
    const value = read[field];
    if (typeof value === "number") merged[field] = value;
  }
  return merged;
}

async function analyzeRecheck(recheck: Recheck): Promise<"NO_CHANGE" | "AWAITING_ADMIN" | "FAILED"> {
  const startedAt = Date.now();
  const original = asValues(recheck.original);
  const [front, read] = await Promise.all([
    compareFront(recheck).catch((error) => ({ error: errorText(error) })),
    readLabels(recheck).catch((error) => ({ error: errorText(error) })),
  ]);
  const frontError = "error" in front ? front.error : null;
  const readError = "error" in read ? read.error : null;
  const now = new Date();
  if (frontError && readError) {
    await prisma.productRecheck.update({
      where: { id: recheck.id },
      data: { status: "FAILED", analyzedAt: now, closedAt: now, error: `Billede: ${frontError} · Energi/indhold: ${readError}`.slice(0, 1000) },
    });
    await debugLog({
      category: "cron",
      event: "product_recheck",
      level: "error",
      message: `2-års tjek fejlede: ${frontError}`,
      productId: recheck.productId,
      durationMs: Date.now() - startedAt,
    });
    return "FAILED";
  }

  const readValues = "error" in read ? null : read;
  const changedFields = readValues ? changedRecheckFields(original, readValues) : [];
  const imageChanged = "error" in front ? null : front.changed;
  // Kunne billedet ikke sammenlignes, tager admin stilling.
  const changed = imageChanged !== false || changedFields.length > 0;
  const status = changed ? "AWAITING_ADMIN" : "NO_CHANGE";
  await prisma.productRecheck.update({
    where: { id: recheck.id },
    data: {
      status,
      analyzedAt: now,
      imageChanged,
      imageNote: "error" in front ? `Billedet kunne ikke sammenlignes: ${front.error}`.slice(0, 1000) : front.note.slice(0, 1000),
      readValues: { ...(readValues ?? {}), productBox: "error" in front ? null : front.productBox } as unknown as Prisma.InputJsonValue,
      changedFields,
      error: readError ? `Energi/indhold: ${readError}`.slice(0, 1000) : null,
      ...(changed ? {} : { closedAt: now }),
    },
  });
  if (!changed) {
    await prisma.product.update({ where: { id: recheck.productId }, data: { qualityCheckedAt: now } });
  }

  // Det nyeste er standard: kunden (og dem, der har tilføjet varen siden
  // scanningen) får de nye tal med det samme. Varen selv venter på admin.
  let refreshed = 0;
  const nutritionFields = nutritionChangedFields(changedFields);
  if (readValues && nutritionFields.length) {
    const base = await currentNutrition(recheck.productId);
    if (base) refreshed = await refreshRegistrationsSince(recheck.productId, recheck.createdAt, withReadValues(base, readValues, nutritionFields));
  }

  await debugLog({
    category: "cron",
    event: "product_recheck",
    level: changed ? "warn" : "info",
    message: changed
      ? `2-års tjek: ${[imageChanged ? "billedet er ændret" : null, changedFields.length ? `ændret: ${changedFields.join(", ")}` : null]
          .filter(Boolean)
          .join(" · ")} — til admin${refreshed ? ` (${refreshed} registreringer fra scanningen fik de nye tal)` : ""}`
      : "2-års tjek: ingen ændringer — lukket",
    productId: recheck.productId,
    durationMs: Date.now() - startedAt,
    data: { recheckId: recheck.id, imageChanged, changedFields, frontError, readError },
  });
  return status;
}

// Admin har valgt det nye billede: det fritlægges nu (om natten). Jobbet får
// ingen productId, så billedrobotten ikke lægger det som et forslag til ny
// godkendelse — admin har allerede taget stilling (applyFinishedCutouts).
async function queueApprovedCutouts(): Promise<string[]> {
  const approved = await prisma.productRecheck.findMany({
    where: { status: "APPROVED", cutoutJobId: null },
    select: { id: true, frontPhotoUrl: true, readValues: true },
  });
  const jobIds: string[] = [];
  for (const recheck of approved) {
    const values = (recheck.readValues ?? {}) as { productBox?: ImageBox | null };
    const job = await prisma.imageCutoutJob.create({
      data: {
        kind: "PRODUCT_FRONT",
        sourceUrl: recheck.frontPhotoUrl,
        cropBox: values.productBox ? (values.productBox as unknown as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    });
    await prisma.productRecheck.update({ where: { id: recheck.id }, data: { cutoutJobId: job.id } });
    jobIds.push(job.id);
  }
  return jobIds;
}

// Færdige fritlægninger sættes direkte på varen. Fejlede fritlægningen,
// beholdes det nuværende billede, og grunden står på tjekket.
async function applyFinishedCutouts(): Promise<number> {
  const waiting = await prisma.productRecheck.findMany({
    where: { status: "APPROVED", cutoutJobId: { not: null } },
    select: { id: true, productId: true, cutoutJobId: true, frontPhotoUrl: true },
  });
  let applied = 0;
  for (const recheck of waiting) {
    const job = await prisma.imageCutoutJob.findUnique({
      where: { id: recheck.cutoutJobId as string },
      select: { status: true, resultUrl: true, error: true },
    });
    const now = new Date();
    if (!job) {
      await prisma.productRecheck.update({ where: { id: recheck.id }, data: { cutoutJobId: null } });
      continue;
    }
    if (job.status === "PENDING") continue;
    if (job.status === "DONE" && job.resultUrl) {
      // Et ikke-godkendt forslag til det gamle billede er overhalet.
      await discardPendingFrontImage(recheck.productId);
      await prisma.product.update({
        where: { id: recheck.productId },
        data: { imageUrl: job.resultUrl, imageStatus: "APPROVED" },
      });
      await prisma.imageCutoutJob.update({ where: { id: recheck.cutoutJobId as string }, data: { appliedAt: now } });
      await resolveCroppedFront(recheck.productId).catch(() => {});
      await prisma.productRecheck.update({ where: { id: recheck.id }, data: { status: "DONE", closedAt: now } });
      applied += 1;
      continue;
    }
    await prisma.productRecheck.update({
      where: { id: recheck.id },
      data: { status: "DONE", closedAt: now, error: `Fritlægningen fejlede — det nuværende billede beholdes: ${job.error ?? "ukendt fejl"}`.slice(0, 1000) },
    });
  }
  return applied;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Det natlige job "product-recheck" (src/lib/jobs/registry.ts).
export async function runProductRechecks(): Promise<{ message: string; count: number }> {
  let applied = await applyFinishedCutouts();

  const submitted = await prisma.productRecheck.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { createdAt: "asc" },
    take: NIGHT_BATCH,
    include: { product: { select: { barcodes: { select: { code: true } } } } },
  });
  const outcome = { NO_CHANGE: 0, AWAITING_ADMIN: 0, FAILED: 0 };
  for (const recheck of submitted) {
    outcome[await analyzeRecheck(recheck)] += 1;
  }

  const queued = await queueApprovedCutouts();
  if (queued.length) {
    const deadline = Date.now() + CUTOUT_WAIT_MS;
    while (Date.now() < deadline) {
      await wait(CUTOUT_POLL_MS);
      const pending = await prisma.imageCutoutJob.count({ where: { id: { in: queued }, status: "PENDING" } });
      if (!pending) break;
    }
    applied += await applyFinishedCutouts();
  }

  const parts = [
    `${submitted.length} vurderet`,
    `${outcome.NO_CHANGE} uændrede`,
    `${outcome.AWAITING_ADMIN} til admin`,
    outcome.FAILED ? `${outcome.FAILED} fejlede` : null,
    queued.length ? `${queued.length} billeder sendt til fritlægning` : null,
    applied ? `${applied} nye billeder sat på varen` : null,
  ].filter(Boolean);
  return { message: `2-års tjek: ${parts.join(", ")}`, count: submitted.length + applied };
}

// ---------------------------------------------------------------------------
// Admin

export type RecheckDecision = { recheckId: string; adminId: string; useNewImage: boolean; useNewData: boolean };

// Admin → Nye varer → 2-års tjek. Næringen/ingredienserne skrives på varen med
// det samme (intet AI-kald); et valgt billede fritlægges i nat.
export async function decideProductRecheck({ recheckId, adminId, useNewImage, useNewData }: RecheckDecision): Promise<boolean> {
  const recheck = await prisma.productRecheck.findUnique({ where: { id: recheckId } });
  if (!recheck || recheck.status !== "AWAITING_ADMIN") return false;
  const now = new Date();
  const read = asValues(recheck.readValues);
  const fields = recheck.changedFields as RecheckField[];
  const nutritionFields = nutritionChangedFields(fields);
  const imageWanted = useNewImage && recheck.imageChanged !== false;

  const claimed = await prisma.productRecheck.updateMany({
    where: { id: recheckId, status: "AWAITING_ADMIN" },
    data: {
      status: imageWanted ? "APPROVED" : "DONE",
      decidedAt: now,
      decidedById: adminId,
      useNewImage: imageWanted,
      useNewData,
      ...(imageWanted ? {} : { closedAt: now }),
    },
  });
  if (claimed.count !== 1) return false;

  const productData: Prisma.ProductUpdateInput = { qualityCheckedAt: now };
  if (useNewData) {
    for (const field of nutritionFields) {
      const value = read[field];
      if (typeof value === "number") productData[field] = value;
    }
    if (fields.includes("ingredientsText") && read.ingredientsText) productData.ingredientsText = read.ingredientsText;
  }
  await prisma.product.update({ where: { id: recheck.productId }, data: productData });

  // Registreringerne fra og med scanningen følger admins valg: de nye tal
  // (også for dem, der har tilføjet varen, mens tjekket ventede) eller
  // varens tal igen. Historikken før scanningen røres ikke.
  if (nutritionFields.length) {
    const base = await currentNutrition(recheck.productId);
    if (base) await refreshRegistrationsSince(recheck.productId, recheck.createdAt, base);
  }
  await debugLog({
    category: "cron",
    event: "product_recheck_decided",
    message: `2-års tjek afgjort: ${imageWanted ? "nyt billede (fritlægges i nat)" : "billedet beholdes"} · ${
      useNewData && fields.length ? `nye værdier (${fields.join(", ")})` : "værdierne beholdes"
    }`,
    productId: recheck.productId,
    data: { recheckId, adminId },
  });
  return true;
}

export type RecheckQueueItem = {
  id: string;
  status: ProductRecheckStatus;
  createdAt: Date;
  productId: string;
  productName: string;
  brand: string | null;
  barcode: string | null;
  productCreatedAt: Date;
  originalImageUrl: string | null;
  frontPhotoUrl: string;
  nutritionPhotoUrl: string | null;
  ingredientsPhotoUrl: string | null;
  imageChanged: boolean | null;
  imageNote: string | null;
  changedFields: RecheckField[];
  original: RecheckValues;
  read: RecheckValues;
  error: string | null;
};

export async function listProductRechecks(statuses: ProductRecheckStatus[], take = 100): Promise<RecheckQueueItem[]> {
  const rows = await prisma.productRecheck.findMany({
    where: { status: { in: statuses } },
    orderBy: { createdAt: "asc" },
    take,
    include: {
      product: {
        select: { name: true, createdAt: true, brand: { select: { name: true } }, barcodes: { select: { code: true }, take: 1 } },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    productId: row.productId,
    productName: row.product.name,
    brand: row.product.brand?.name ?? null,
    barcode: row.product.barcodes[0]?.code ?? null,
    productCreatedAt: row.product.createdAt,
    originalImageUrl: row.originalImageUrl,
    frontPhotoUrl: row.frontPhotoUrl,
    nutritionPhotoUrl: row.nutritionPhotoUrl,
    ingredientsPhotoUrl: row.ingredientsPhotoUrl,
    imageChanged: row.imageChanged,
    imageNote: row.imageNote,
    changedFields: row.changedFields as RecheckField[],
    original: asValues(row.original),
    read: asValues(row.readValues),
    error: row.error,
  }));
}

export async function countProductRechecks() {
  const [awaiting, waitingForNight] = await Promise.all([
    prisma.productRecheck.count({ where: { status: "AWAITING_ADMIN" } }),
    prisma.productRecheck.count({ where: { status: { in: ["SUBMITTED", "APPROVED"] } } }),
  ]);
  return { awaiting, waitingForNight };
}
