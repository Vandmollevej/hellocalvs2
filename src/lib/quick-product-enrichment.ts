import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeBarcodePhotoLogo,
  analyzeFrontPhoto,
  analyzeIngredientsPhoto,
  analyzeLabelPhoto,
  analyzeNutritionPhoto,
  recordLocalAnalysis,
} from "@/lib/product-photo-analysis";
import { localIngredients, localNutrition } from "@/lib/local-label";
import { loadSpellingDictionary } from "@/lib/spelling-dictionary";
import { hasIngredientsHeading } from "@/lib/product-ocr";
import { createBarcodeLogoCutoutJob, linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { matchBrand, newBrandAllowed } from "@/lib/brand-match";
import { cleanAlternativeServings } from "@/lib/alternative-servings";
import { flagUncertainAlternativeServings } from "@/lib/alternative-servings-review";
import { flagSimultaneousDuplicates } from "@/lib/product-duplicates";
import { recordNutrientSources } from "@/lib/product-nutrient-sources";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import type { IngredientsAnalysis, NutritionAnalysis } from "@/lib/product-analysis-types";
import { debugLog, errorText } from "@/lib/debug-log";
import { composeProductName, normalizeProductName } from "@/lib/product-naming";
import { petFoodBlockReason } from "@/lib/pet-food-blacklist";
import { recordPetFoodAttempt } from "@/lib/pet-food-strikes";
import { rejectProduct } from "@/lib/product-approval";
import { addCertificationFilters } from "@/lib/product-certification-filters";
import { cleanLanguageSignals } from "@/lib/barcode-context";
import { refreshProductLanguage } from "@/lib/product-translations";
import { brandProductName, isPlaceholderProductName } from "@/lib/product-placeholder-name";
import { askProductType, findProductType } from "@/lib/product-type-name";
import { parseAlcoholPercent } from "@/lib/alcohol-label";
import { estimateAlcoholNutrition, recordAlcoholPercent } from "@/lib/alcohol-nutrition";
import { productTypeFromText, readFrontText } from "@/lib/front-text-name";
import { energyReadOk } from "@/lib/energy-read";
import { MACRO_SOURCE_KEYS } from "@/lib/nutrients";

// "Opret straks" (docs/DECISIONS.md 2026-09-27): kameraflowet opretter varen,
// så snart den lokale OCR er kørt, og sender brugeren videre til /add/[id].
// Her udfyldes resten bagefter. Forsiden (navn/brand/subbrand) læses af
// OpenAI. Energi og indhold følger brugerens valg "lokal først + ét samlet
// kald": telefonens OCR bruges, når den kan læses sikkert, og ellers læser
// ét OpenAI-kald det, der mangler. Hvert felt fjernes fra
// Product.pendingFields, så snart det er aflæst (eller aflæsningen fejlede).

export type PendingField = "name" | "brand" | "nutrition" | "ingredients";

export type QuickEnrichmentInput = {
  productId: string;
  barcode: string;
  marketRegion: string;
  // Telefonens land/sprog og appens sprog, fastfrosset ved scanningen.
  signals?: unknown;
  frontPhoto: string;
  nutritionPhoto: string;
  // Udeladt, når ingredienslisten stod på næringsfotoet.
  ingredientsPhoto?: string;
  // Samme fotos, allerede gemt ved oprettelsen (quick_enrichment_jobs), så
  // analyserne ikke gemmer en kopi mere.
  frontPhotoUrl?: string | null;
  nutritionPhotoUrl?: string | null;
  ingredientsPhotoUrl?: string | null;
  // Telefonens tekstlæsning af forsiden — reserve til navn/brand, når
  // OpenAI ikke kan læse forsiden (src/lib/front-text-name.ts).
  frontOcrText?: string;
  // Energien, AI'en læste under flowet (POST /api/products/read-energy).
  nutritionAnalysisId?: string | null;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
  // Navn, hvis OpenAI ikke kan læse forsiden.
  fallbackName: string;
  // Stregkode-fotoets AiProductAnalysis (kind=BARCODE), hvis det nåede at
  // blive gemt — læses for logo og variant.
  barcodeAnalysisId?: string | null;
  // "Scan varen igen" (docs/DECISIONS.md 2026-10-02): varen er ikke ny, så
  // dens registreringer kan være dage gamle og skal beholde deres snapshot,
  // og en mislykket næringsaflæsning må ikke nedgradere dens kilder.
  existingProduct?: boolean;
  // Sat, når en tynd Open Food Facts-vare fyldes op: kun registreringer fra
  // og med dette tidspunkt regnes om — ældre beholder deres snapshot.
  snapshotsSince?: Date;
};

// Atomisk i SQL: aflæsningerne rydder hver sine felter samtidig.
export async function clearPending(productId: string, fields: PendingField[]) {
  await prisma.$executeRaw`
    UPDATE "products"
    SET "pendingFields" = ARRAY(
      SELECT field FROM unnest("pendingFields") AS field WHERE NOT (field = ANY(${fields}::text[]))
    )
    WHERE "id" = ${productId}`;
}

// Registreringer lavet, mens næringen stadig blev aflæst, fik et foreløbigt
// snapshot. Varen er få minutter gammel, så alle dens registreringer stammer
// fra den periode og regnes om med de aflæste tal.
async function refreshRegistrationSnapshots(
  productId: string,
  input?: Pick<QuickEnrichmentInput, "existingProduct" | "snapshotsSince">,
) {
  if (input?.existingProduct) return;
  const since = input?.snapshotsSince;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
  if (!product) return;
  const registrations = await prisma.registration.findMany({
    where: { productId, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { id: true, amountGrams: true },
  });
  for (const registration of registrations) {
    const factor = registration.amountGrams / 100;
    await prisma.registration.update({
      where: { id: registration.id },
      data: {
        titleSnapshot: product.name,
        kcalSnapshot: product.kcalPer100g * factor,
        proteinSnapshot: product.proteinPer100g * factor,
        carbsSnapshot: product.carbsPer100g * factor,
        fatSnapshot: product.fatPer100g * factor,
      },
    });
  }
}

// Forside-aflæsningen fejlede teknisk: navn og brand udledes af telefonens
// tekstlæsning af forsiden (kendt brand i teksten + et varenavn, der findes i
// databasen), ellers spørges "Hvilken produkttype er <brand>?". Udfylder kun
// tomme felter og aldrig på en eksisterende vare.
async function applyFrontTextFallback(input: QuickEnrichmentInput) {
  if (input.existingProduct) return;
  const { productId } = input;
  const current = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, brandId: true } });
  if (!current) return;
  const nameMissing = !current.name.trim() || isPlaceholderProductName(current.name);
  if (!nameMissing && current.brandId) return;
  const { brand, productType } = await readFrontText(input.frontOcrText);
  const typeName =
    productType ?? (brand ? await askProductType({ brand: brand.name }).catch(() => null) : null);
  const name = nameMissing ? (typeName ?? brandProductName(brand?.name, null)) : "";
  if (!name && !(brand && !current.brandId)) {
    await debugLog({
      category: "scan",
      event: "enrich_front_fallback",
      level: "warn",
      message: "Forsiden kunne heller ikke navngives ud fra telefonens tekst — AI'en prøver igen",
      productId,
      data: { frontOcrText: input.frontOcrText?.slice(0, 300) ?? null },
    });
    return;
  }
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(name ? { name } : {}),
      ...(brand && !current.brandId ? { brandId: brand.id } : {}),
    },
    select: { id: true, name: true, createdAt: true },
  });
  if (name) await flagSimultaneousDuplicates(product.id, product.name, product.createdAt);
  await debugLog({
    category: "scan",
    event: "enrich_front_fallback",
    level: "warn",
    message: `Forsiden navngivet ud fra telefonens tekst: ${brand ? `${brand.name} — ` : ""}${product.name || "(intet navn)"}`,
    productId,
    data: { brand: brand?.name ?? null, productType, name: product.name },
  });
}

// Lokal genlæsning (brugerens krav 2026-10-16: "hvorfor kan du ikke behandle
// billederne igen?"): serverens egen tekstlæsning (tesseract på de gemte
// originalbilleder, quality-control-agent back_local.py) retter en ny vare
// uden navn — også når OpenAI ikke kan svare.
export async function applyFrontTextFromServerOcr(productId: string, text: string): Promise<boolean> {
  const before = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
  if (!before || (before.name.trim() && !isPlaceholderProductName(before.name))) return false;
  await applyFrontTextFallback({ productId, barcode: "", marketRegion: "DK", frontPhoto: "", nutritionPhoto: "", fallbackName: "", frontOcrText: text });
  const after = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
  return Boolean(after?.name.trim());
}

// Samme for energien: næringstabellen læst lokalt af serveren fra det gemte
// energibillede. Kun en komplet aflæsning pr. 100 g/ml bruges (energyReadOk) —
// aldrig et skøn. Returnerer true, når energien blev gemt.
export async function applyServerNutritionOcr(input: {
  productId: string;
  barcode: string;
  marketRegion: string;
  signals?: unknown;
  text: string;
  confidence: number;
  imageUrl: string;
}): Promise<boolean> {
  const read = localNutrition(input.text, input.confidence);
  if (!read || !energyReadOk(read)) return false;
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { kcalPer100g: true } });
  if (!product || product.kcalPer100g > 0) return false;
  const { analysisId } = await recordLocalAnalysis({
    kind: "NUTRITION",
    photo: "",
    barcode: input.barcode,
    marketRegion: input.marketRegion,
    signals: input.signals,
    prediction: read,
    storedImageUrl: input.imageUrl,
  });
  await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: input.productId } });
  await prisma.product.update({
    where: { id: input.productId },
    data: {
      kcalPer100g: read.kcalPer100g!,
      proteinPer100g: read.proteinPer100g!,
      carbsPer100g: read.carbsPer100g!,
      fatPer100g: read.fatPer100g!,
      ...(typeof read.saturatedFatPer100g === "number" && read.saturatedFatPer100g >= 0
        ? { saturatedFatPer100g: read.saturatedFatPer100g }
        : {}),
    },
  });
  await recordNutrientSources(input.productId, analysisId);
  await setNutritionKnown(input.productId, true);
  await refreshRegistrationSnapshots(input.productId).catch(() => {});
  await syncProductNutritionFeaturesSafely(input.productId);
  await debugLog({
    category: "scan",
    event: "local_reread",
    message: `Energi læst lokalt af serveren fra det gemte billede: ${read.kcalPer100g} kcal/100`,
    productId: input.productId,
    data: { kcal: read.kcalPer100g, protein: read.proteinPer100g, carbs: read.carbsPer100g, fat: read.fatPer100g, confidence: input.confidence },
  });
  return true;
}

// Returnerer, om forsidefotoet blev genkendt som en vare (navn, logo eller
// vareboks) — null, hvis aflæsningen fejlede teknisk.
export async function enrichFront(input: QuickEnrichmentInput): Promise<boolean | null> {
  const { productId } = input;
  const startedAt = Date.now();
  let recognized: boolean | null = null;
  try {
    const { analysisId, result, brandMatch, textBrandMatch } = await analyzeFrontPhoto({
      photo: input.frontPhoto,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
      storedImageUrl: input.frontPhotoUrl,
    });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId } });

    // Logonavnet er holdt op mod brand-databasen; et match giver databasens
    // stavemåde, så der ikke oprettes en næsten-dublet. Kender databasen ikke
    // AI'ens brand, men står et kendt brand ordret på forsiden (fx EDEKA ved
    // vareserien Herzstücke), vinder databasens brand, og AI'ens brand bliver
    // subbrand (brugerens krav 2026-10-02).
    // Et ukendt navn oprettes kun ud fra et sikkert, helt synligt logo
    // (newBrandAllowed, DAGO 2026-10-15); ellers får varen intet brand.
    const aiBrand = (result.brand ?? result.logoText ?? "").trim();
    const newBrand = newBrandAllowed(result.logoConfidence, result.logoBox) ? aiBrand : "";
    const brandName = (brandMatch?.name ?? textBrandMatch?.name ?? newBrand).trim();
    if (aiBrand && !brandName) {
      await debugLog({
        category: "scan",
        event: "brand_unknown_skipped",
        level: "warn",
        message: `Ukendt brand "${aiBrand}" ikke oprettet — logoet var usikkert (${result.logoConfidence}) eller skåret af ved kanten`,
        productId,
      });
    }
    const brand = brandName
      ? await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } })
      : null;
    const subbrand =
      result.subbrand?.trim() ||
      (textBrandMatch && aiBrand && aiBrand.toLowerCase() !== textBrandMatch.name.toLowerCase() ? aiBrand : null);
    // Navnet sammensættes som ved manuel oprettelse (produkttype, docs/
    // DECISIONS.md 2026-09-23). Varianten og pakningsstørrelsen står i hver
    // sit felt og vises på den grønne linje under titlen — de må aldrig
    // gentages i selve navnet (brugerens regel 2026-10-02).
    const variant = result.variant?.trim() ?? "";
    const packageSizeText = result.packageSizeText?.trim() ?? "";
    const rawName = result.productName?.trim() ?? "";
    // Intet varenavn på forsiden (fx Verpoorten Original): varetypen navngives
    // ud fra brand, variant og synlig tekst (fx Eierlikör), ellers spørges
    // "Hvilken produkttype er <brand subbrand variant>?"; ellers det hidtidige
    // navn, ellers brand + subbrand. Aldrig "Vare <stregkode>" og aldrig
    // varianten (brugerens regel 2026-10-15).
    const typeName = rawName
      ? null
      : await findProductType(result, {
          brand: brand?.name,
          subbrand,
          variant,
          packageSizeText,
          alcoholPercent: result.alcoholPercent,
          language: result.language,
        });
    // Sidste udvej uden AI: et kendt varenavn i forsidens tekst (telefonens
    // læsning + det AI'en så), fx "LETMÆLK" → Letmælk (docs/DECISIONS.md 2026-10-16).
    const textName =
      rawName || typeName
        ? null
        : await productTypeFromText(
            [input.frontOcrText, ...(result.visibleText ?? []), ...(result.claims ?? [])],
            [brand?.name, subbrand].filter((part): part is string => Boolean(part)),
          ).catch(() => null);
    const productName = rawName || typeName || textName || "";
    recognized = Boolean(rawName || result.logoText?.trim() || result.productBox);
    const fallbackName = isPlaceholderProductName(input.fallbackName) ? "" : input.fallbackName;
    const name = productName
      ? variant && !productName.toLowerCase().includes(variant.toLowerCase())
        ? composeProductName({ productType: productName, variant })
        : normalizeProductName(productName)
      : fallbackName || brandProductName(brand?.name, subbrand);
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        brandId: brand?.id,
        subbrand: subbrand ?? undefined,
        variant: variant || undefined,
        packageSizeText: packageSizeText || undefined,
        // Varetypen er spurgt om — vedligeholdet spørger ikke igen.
        productTypeAskedAt: rawName ? undefined : new Date(),
      },
      select: { id: true, name: true, createdAt: true },
    });
    if (product.name) await flagSimultaneousDuplicates(product.id, product.name, product.createdAt);
    await recordAlcoholPercent(
      productId,
      result.alcoholPercent ?? parseAlcoholPercent([...(result.visibleText ?? []), ...(result.claims ?? [])].join(" ")),
    ).catch((error) => console.error("Could not save alcohol percent", productId, error));
    // Mærkningslogoerne (Ø-mærket, Nøglehullet …) vises på varesiden.
    const certifications = await addCertificationFilters(productId, result.certifications ?? []).catch((error) => {
      console.error("Could not save certifications", productId, error);
      return [];
    });
    await linkCutoutJobsToProduct({
      frontAnalysisId: analysisId,
      productId,
      brand: brand ? { id: brand.id, name: brand.name } : null,
    }).catch((error) => console.error("Could not link cutout jobs", error));
    await debugLog({
      category: "scan",
      event: "enrich_front",
      message: `Forside læst af AI: ${brand ? `${brand.name} — ` : ""}${name || "(intet navn)"}${
        rawName ? "" : typeName ? " (varetypen navngivet ud fra forsiden)" : name ? " (intet varenavn — brand + subbrand)" : " (intet varenavn og intet brand)"
      }`,
      level: name ? "info" : "warn",
      productId,
      durationMs: Date.now() - startedAt,
      data: {
        name,
        brand: brand?.name ?? null,
        brandMatchedDatabase: Boolean(brandMatch || textBrandMatch),
        brandFromFrontText: textBrandMatch?.name ?? null,
        aiBrand: aiBrand || null,
        subbrand: subbrand ?? null,
        variant: result.variant ?? null,
        packageSizeText: result.packageSizeText ?? null,
        certificationsRead: result.certifications ?? [],
        certificationsSaved: certifications,
      },
    });
  } catch (error) {
    console.error("Quick product front enrichment failed", productId, error);
    await debugLog({
      category: "scan",
      event: "enrich_front",
      level: "error",
      message: `Forside-aflæsningen fejlede: ${errorText(error)}`,
      productId,
      durationMs: Date.now() - startedAt,
    });
    // Varen må ikke stå uden navn og brand: telefonens tekstlæsning af
    // forsiden bruges, til AI'en har læst den (genforsøg i
    // quick-enrichment-recovery, docs/DECISIONS.md 2026-10-16).
    await applyFrontTextFallback(input).catch((fallbackError) =>
      console.error("Front text fallback failed", productId, fallbackError),
    );
  } finally {
    await clearPending(productId, ["name", "brand"]);
    // Navnet indgår i registreringernes titleSnapshot.
    await refreshRegistrationSnapshots(productId, input).catch(() => {});
  }
  return recognized;
}

// Stregkode-fotoet (docs/DECISIONS.md 2026-09-28): logoet står ikke altid på
// forsiden. Kører efter forsiden, så den kun udfylder det forsiden manglede:
// - et logo i fotoet bliver altid et fritskrabnings-job (logo-kandidat),
// - brand sættes kun, hvis forsiden intet brand gav,
// - variant (fx "Uden brus") kun, hvis forsiden ingen variant gav.
async function enrichBarcodeLogo(input: QuickEnrichmentInput) {
  const { productId, barcodeAnalysisId } = input;
  if (!barcodeAnalysisId) return;
  const startedAt = Date.now();
  try {
    const read = await analyzeBarcodePhotoLogo({
      analysisId: barcodeAnalysisId,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
    });
    if (!read) {
      await debugLog({
        category: "scan",
        event: "enrich_barcode_logo",
        level: "warn",
        message: "Stregkode-fotoet kunne ikke findes — intet logo læst derfra",
        productId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    const { result, brandMatch, imageUrl } = read;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, variant: true, subbrand: true, brand: { select: { id: true, name: true } } },
    });
    if (!product) return;

    const logoText = result.logoText?.trim() || null;
    const changes: Prisma.ProductUpdateInput = {};
    let brand = product.brand;
    const newBrand = logoText && newBrandAllowed(result.logoConfidence, result.logoBox) ? logoText : "";
    const brandName = (brandMatch?.name ?? newBrand).trim();
    if (!brand && brandName && result.logoConfidence >= 0.5) {
      brand = await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName }, select: { id: true, name: true } });
      changes.brand = { connect: { id: brand.id } };
    }

    // Varianten står kun i sit eget felt (grøn linje) — aldrig i navnet
    // (brugerens regel 2026-10-02). Stod den allerede i navnet, fjernes den.
    // Forsiden gav hverken varenavn eller brand: varen hedder varetypen eller
    // brand + subbrand, når stregkode-fotoet gav brandet (brugerens regel 2026-10-15).
    const nameless = !product.name.trim() || isPlaceholderProductName(product.name);
    const brandOnlyName = nameless || product.name === brandProductName(product.brand?.name, product.subbrand);
    // Først spørges, hvilken produkttype brand + subbrand + variant er.
    if (nameless && brand) {
      const typeName = await askProductType({
        brand: brand.name,
        subbrand: product.subbrand,
        variant: product.variant || result.variant,
      }).catch(() => null);
      changes.name = typeName ?? brandProductName(brand.name, product.subbrand);
      changes.productTypeAskedAt = new Date();
    }

    const variant = result.variant?.trim() ?? "";
    if (!product.variant && variant && result.variantConfidence >= 0.5) {
      changes.variant = variant;
      if (!brandOnlyName && product.name !== input.fallbackName && !product.name.toLowerCase().includes(variant.toLowerCase())) {
        changes.name = composeProductName({ productType: product.name, variant });
      }
    }
    if (Object.keys(changes).length) {
      await prisma.product.update({ where: { id: productId }, data: changes });
      if (changes.name) await refreshRegistrationSnapshots(productId, input).catch(() => {});
    }

    // Logo-jobbet kobles til varens brand, når logoet er det brand;
    // ellers til det bedste match i brand-databasen.
    let logoJobCreated = false;
    if (result.logoBox) {
      const productBrandMatch = brand ? matchBrand(logoText, [brand]) : null;
      await createBarcodeLogoCutoutJob({
        analysisId: barcodeAnalysisId,
        sourceUrl: imageUrl,
        logoBox: result.logoBox,
        logoText,
        logoConfidence: result.logoConfidence,
        productId,
        brandMatch: productBrandMatch ?? brandMatch,
      });
      logoJobCreated = true;
    }

    await debugLog({
      category: "scan",
      event: "enrich_barcode_logo",
      message: `Stregkode-foto læst af AI: ${logoText ? `logo "${logoText}"` : "intet logo"}${variant ? ` · variant "${variant}"` : ""}${
        changes.brand ? " · brand sat fra stregkode-fotoet" : ""
      }${changes.variant ? " · variant sat fra stregkode-fotoet" : ""}`,
      productId,
      durationMs: Date.now() - startedAt,
      data: {
        logoText,
        logoConfidence: result.logoConfidence,
        brandMatch,
        variant: variant || null,
        variantConfidence: result.variantConfidence,
        logoJobCreated,
        changedFields: Object.keys(changes),
      },
    });
  } catch (error) {
    console.error("Quick product barcode logo enrichment failed", productId, error);
    await debugLog({
      category: "scan",
      event: "enrich_barcode_logo",
      level: "error",
      message: `Logo-aflæsningen af stregkode-fotoet fejlede: ${errorText(error)}`,
      productId,
      durationMs: Date.now() - startedAt,
    });
  }
}

type Read<T> = { analysisId: string; result: T } | null;

// Energi + indhold: lokal først, ét samlet OpenAI-kald for det, der mangler.
// - Næringen bruges lokalt, når alle fire hovedtal findes og hænger sammen.
// - Ingredienslisten bruges lokalt ved en tydelig "Ingredienser:"-sektion og
//   OCR-sikkerhed >= 85 % (src/lib/local-label.ts).
// - Mangler næringen, og står indholdet på samme foto: ét kald til begge.
// - Ellers kun det kald, der mangler (to separate fotos kræver to kald).
// Hvad der blev læst fra brugerens fotos — "Scan varen igen" bruger det til
// at afgøre, om varen kan overtages som vores egen (src/lib/product-rescan.ts).
export type LabelReadOutcome = { nutritionComplete: boolean; aiFailed: boolean; ingredientsRead: boolean; saturatedFatRead: boolean };

// Uden komplet næringstabel er 0 kun en pladsholder: varen står som "næring
// ukendt" (hasKnownNutrition = false i appen, aldrig "∼ 0 kalorier"), og de
// skøn-kilder, recordNutrientSources satte på makroerne, fjernes.
async function setNutritionKnown(productId: string, known: boolean) {
  try {
    if (known) {
      // Et tidligere skøn (Frida/varetypen) er afløst af emballagens egne tal.
      await prisma.product.update({ where: { id: productId }, data: { nutritionMissing: false, fridaEstimateId: null } });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { kcalPer100g: true, nutrientSources: true } });
    if (!product || product.kcalPer100g > 0) return;
    const sources = { ...((product.nutrientSources as Record<string, string> | null) ?? {}) };
    for (const key of MACRO_SOURCE_KEYS) delete sources[key];
    await prisma.product.update({
      where: { id: productId },
      data: { nutritionMissing: true, nutrientSources: Object.keys(sources).length ? sources : Prisma.DbNull },
    });
  } catch (error) {
    console.error("Could not mark nutrition known/unknown", productId, error);
  }
}

// Energiens aflæsning fra flowet (POST /api/products/read-energy).
async function loadPrereadNutrition(analysisId: string | null | undefined): Promise<Read<NutritionAnalysis>> {
  if (!analysisId) return null;
  const row = await prisma.aiProductAnalysis
    .findUnique({ where: { id: analysisId }, select: { id: true, kind: true, prediction: true } })
    .catch(() => null);
  if (!row || row.kind !== "NUTRITION" || !row.prediction) return null;
  return { analysisId: row.id, result: row.prediction as unknown as NutritionAnalysis };
}

// Kvalitetskontrollens rettelser og tvivl i admin → Log (tvivl sætter også
// aflæsningen på Usikkerheder → Indhold, src/lib/product-photo-analysis.ts).
async function logIngredientsReview(productId: string, result: IngredientsAnalysis, source: string) {
  const review = result.textReview;
  if (!review || (!review.fixes.length && !review.doubts.length)) return;
  await debugLog({
    category: "scan",
    event: "ingredients_text_review",
    level: review.doubts.length ? "warn" : "info",
    message: review.doubts.length
      ? `Ingredienslisten (${source}) ser fejllæst ud: ${review.doubts.join("; ")} — sendt til Usikkerheder`
      : `Ingredienslisten (${source}) rettet automatisk: ${review.fixes.join("; ")}`,
    productId,
    data: { source, fixes: review.fixes, doubts: review.doubts, ingredientsText: result.ingredientsText.slice(0, 500) },
  });
}

export async function enrichLabel(input: QuickEnrichmentInput): Promise<LabelReadOutcome> {
  const { productId } = input;
  const base = { barcode: input.barcode, marketRegion: input.marketRegion, signals: input.signals };
  const nutritionText = input.nutritionOcrText ?? "";
  const ingredientsPhoto = input.ingredientsPhoto ?? input.nutritionPhoto;
  const nutritionPhotoUrl = input.nutritionPhotoUrl ?? null;
  const ingredientsPhotoUrl = input.ingredientsPhoto ? (input.ingredientsPhotoUrl ?? null) : nutritionPhotoUrl;
  const ingredientsText = input.ingredientsPhoto ? (input.ingredientsOcrText ?? "") : nutritionText;
  const ingredientsConfidence = input.ingredientsPhoto ? input.ingredientsOcrConfidence : input.nutritionOcrConfidence;

  // Energien, AI'en allerede læste under flowet (read-energy), læses ikke igen.
  const prereadN = await loadPrereadNutrition(input.nutritionAnalysisId);
  const localN = prereadN ? null : localNutrition(nutritionText, input.nutritionOcrConfidence ?? 0);
  const haveNutrition = Boolean(prereadN || localN);
  const localI = localIngredients(ingredientsText, ingredientsConfidence ?? 0, await loadSpellingDictionary());

  let nutrition: Read<NutritionAnalysis> = null;
  let ingredients: Read<IngredientsAnalysis> = null;
  const startedAt = Date.now();
  // Til admin "Log": hvilken vej aflæsningen tog, og hvad der evt. fejlede.
  let labelPath = "local";
  const labelErrors: string[] = [];

  try {
    if (!haveNutrition && !input.ingredientsPhoto) {
      labelPath = "openai-combined";
      const both = await analyzeLabelPhoto({
        ...base,
        photo: input.nutritionPhoto,
        ocrText: nutritionText,
        storedImageUrl: nutritionPhotoUrl,
      });
      nutrition = both.nutrition;
      // En sikker lokal ingrediensliste beholdes kun, hvis OpenAI intet fandt.
      if (both.ingredients.result.ingredientsText || !localI) ingredients = both.ingredients;
    } else {
      const wantIngredients =
        !localI && (Boolean(input.ingredientsPhoto) || !ingredientsText || hasIngredientsHeading(ingredientsText));
      labelPath = `nutrition:${prereadN ? "flow" : localN ? "local" : "openai"}, ingredients:${wantIngredients ? "openai" : localI ? "local" : "skipped"}`;
      const [nutritionRead, ingredientsRead] = await Promise.all([
        haveNutrition
          ? Promise.resolve(prereadN)
          : analyzeNutritionPhoto({
              ...base,
              photo: input.nutritionPhoto,
              ocrText: nutritionText,
              storedImageUrl: nutritionPhotoUrl,
            }).catch((error) => {
              console.error("Quick product nutrition enrichment failed", productId, error);
              labelErrors.push(`nutrition: ${errorText(error)}`);
              return null;
            }),
        wantIngredients
          ? analyzeIngredientsPhoto({
              ...base,
              photo: ingredientsPhoto,
              ocrText: ingredientsText,
              storedImageUrl: ingredientsPhotoUrl,
            }).catch((error) => {
              console.error("Quick product ingredients enrichment failed", productId, error);
              labelErrors.push(`ingredients: ${errorText(error)}`);
              return null;
            })
          : Promise.resolve(null),
      ]);
      nutrition = nutritionRead;
      ingredients = ingredientsRead;
    }
  } catch (error) {
    console.error("Quick product label enrichment failed", productId, error);
    labelErrors.push(`label: ${errorText(error)}`);
  }
  const nutritionFromAi = Boolean(nutrition);
  const ingredientsFromAi = Boolean(ingredients);

  try {
    if (!nutrition && localN) {
      const { analysisId } = await recordLocalAnalysis({
        ...base,
        kind: "NUTRITION",
        photo: input.nutritionPhoto,
        prediction: localN,
        storedImageUrl: nutritionPhotoUrl,
      });
      nutrition = { analysisId, result: localN };
    }
    if (!ingredients && localI) {
      const { analysisId } = await recordLocalAnalysis({
        ...base,
        kind: "INGREDIENTS",
        photo: ingredientsPhoto,
        prediction: localI,
        storedImageUrl: ingredientsPhotoUrl,
      });
      ingredients = { analysisId, result: localI };
    }

    if (nutrition) {
      await prisma.aiProductAnalysis.update({ where: { id: nutrition.analysisId }, data: { productId } });
      const read = nutrition.result;
      const complete =
        read.kcalPer100g != null && read.proteinPer100g != null && read.carbsPer100g != null && read.fatPer100g != null;
      const alternativeServings = cleanAlternativeServings(read.alternativeServings ?? []);
      const per100 = read.basis === "100g" || read.basis === "100ml";
      await prisma.product.update({
        where: { id: productId },
        data: {
          ...(complete
            ? {
                kcalPer100g: read.kcalPer100g!,
                proteinPer100g: read.proteinPer100g!,
                carbsPer100g: read.carbsPer100g!,
                fatPer100g: read.fatPer100g!,
              }
            : {}),
          ...(per100 && typeof read.saturatedFatPer100g === "number" && read.saturatedFatPer100g >= 0
            ? { saturatedFatPer100g: read.saturatedFatPer100g }
            : {}),
          ...(alternativeServings.length
            ? { alternativeServings: alternativeServings as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
      if (alternativeServings.length) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
        await flagUncertainAlternativeServings(productId, product?.name ?? "", alternativeServings);
      }
    }

    // Alkoholprocenten står også, når der ingen næringstabel er (spiritus).
    await recordAlcoholPercent(
      productId,
      nutrition?.result.alcoholPercent ?? parseAlcoholPercent(`${nutritionText}\n${ingredientsText}`),
    ).catch((error) => console.error("Could not save alcohol percent", productId, error));

    if (ingredients) {
      await prisma.aiProductAnalysis.update({ where: { id: ingredients.analysisId }, data: { productId } });
      if (ingredients.result.ingredientsText) {
        await prisma.product.update({ where: { id: productId }, data: { ingredientsText: ingredients.result.ingredientsText } });
      }
      await logIngredientsReview(productId, ingredients.result, ingredientsFromAi ? "AI" : "telefonens aflæsning");
    }
  } catch (error) {
    console.error("Quick product label could not be saved", productId, error);
    labelErrors.push(`save: ${errorText(error)}`);
  }
  const read = nutrition?.result;
  const nutritionComplete =
    read != null && read.kcalPer100g != null && read.proteinPer100g != null && read.carbsPer100g != null && read.fatPer100g != null;
  try {
    if (nutrition) await recordNutrientSources(productId, nutrition.analysisId);
    // En ny vare uden komplet næringstabel står med 0 som pladsholder: den
    // markeres som "næring ukendt" (aldrig "∼ 0 kalorier"), så Frida/varetypen
    // kan give et skøn (enrichQuickProduct, docs/DECISIONS.md 2026-10-16).
    if (!input.existingProduct) await setNutritionKnown(productId, nutritionComplete);
  } finally {
    await clearPending(productId, ["nutrition", "ingredients"]);
    await refreshRegistrationSnapshots(productId, input).catch(() => {});
  }

  const nutritionSource = nutrition ? (nutritionFromAi ? "OpenAI" : "telefonens OCR") : "ingen";
  const ingredientsSource = ingredients ? (ingredientsFromAi ? "OpenAI" : "telefonens OCR") : "ingen";
  await debugLog({
    category: "scan",
    event: "enrich_label",
    level: labelErrors.length || !nutritionComplete ? (nutrition ? "warn" : "error") : "info",
    message: `Energi: ${nutritionComplete ? `${read!.kcalPer100g} kcal/100 (${nutritionSource})` : `ikke komplet (${nutritionSource})`} · Ingredienser: ${
      ingredients?.result.ingredientsText ? `${ingredients.result.ingredientsText.length} tegn (${ingredientsSource})` : `ingen (${ingredientsSource})`
    }`,
    productId,
    durationMs: Date.now() - startedAt,
    data: {
      path: labelPath,
      nutrition: read ?? null,
      ingredientsText: ingredients?.result.ingredientsText?.slice(0, 500) ?? null,
      errors: labelErrors,
    },
  });
  return {
    nutritionComplete,
    // OpenAI-kaldet fejlede teknisk (ikke blot "ingen tabel på fotoet") —
    // aflæsningen prøves igen af quick-enrichment-recovery.
    aiFailed: !nutritionComplete && labelErrors.some((error) => !error.startsWith("save:")),
    ingredientsRead: Boolean(ingredients?.result.ingredientsText),
    saturatedFatRead:
      (read?.basis === "100g" || read?.basis === "100ml") &&
      typeof read?.saturatedFatPer100g === "number" &&
      read.saturatedFatPer100g >= 0,
  };
}

// Hvilke dele der køres. En genoptagelse (src/lib/quick-enrichment-jobs.ts)
// kører kun de dele, hvis felter stadig står i Product.pendingFields.
// `barcodeLogo: false` ved et genforsøg, hvor stregkode-logoet allerede er læst.
export type QuickEnrichmentParts = { front: boolean; label: boolean; barcodeLogo?: boolean };
export type QuickEnrichmentRetry = { front: boolean; label: boolean };

export async function enrichQuickProduct(
  input: QuickEnrichmentInput,
  parts: QuickEnrichmentParts = { front: true, label: true },
): Promise<QuickEnrichmentRetry> {
  const startedAt = Date.now();
  const [front, label] = await Promise.all([
    parts.front
      ? enrichFront(input).then(async (recognized) => {
          if (parts.barcodeLogo !== false) await enrichBarcodeLogo(input);
          return recognized;
        })
      : Promise.resolve(undefined),
    parts.label ? enrichLabel(input) : Promise.resolve(undefined),
  ]);
  // Alkoholisk drik uden næringstabel: energien regnes ud fra % vol og
  // varetypen, i stedet for at stå med 0 kcal (docs/DECISIONS.md 2026-10-15).
  // Andre varer skønnes aldrig (brugerens krav 2026-10-16): energi-trinnet i
  // flowet klares først, når energien er læst.
  if (!input.existingProduct && (await estimateAlcoholNutrition(input.productId))) {
    await refreshRegistrationSnapshots(input.productId, input).catch(() => {});
  }
  // Varens sprog (docs/DECISIONS.md 2026-10-15): scanningslandet, eller
  // skriftens sprog, når forsiden har fx kinesiske tegn. Teksten røres ikke.
  await refreshProductLanguage(
    input.productId,
    cleanLanguageSignals(input.signals).locationCountry ?? input.marketRegion,
  ).catch((error) => console.error("Could not set product language", input.productId, error));
  await syncProductNutritionFeaturesSafely(input.productId);

  // Dele, hvor OpenAI-kaldet fejlede teknisk: de prøves igen af
  // quick-enrichment-recovery med de gemte fotos (docs/DECISIONS.md 2026-10-16).
  const retry: QuickEnrichmentRetry = { front: front === null, label: label?.aiFailed === true };

  const product = await prisma.product
    .findUnique({
      where: { id: input.productId },
      select: {
        name: true,
        pendingFields: true,
        kcalPer100g: true,
        ingredientsText: true,
        createdByUserId: true,
        brand: { select: { name: true } },
      },
    })
    .catch(() => null);

  // Dyrefoder-spærring: først nu kender vi navn/brand/ingredienser — er det
  // dyrefoder, afvises varen med det samme (src/lib/pet-food-blacklist.ts).
  const petFoodBlock = product
    ? await petFoodBlockReason({ texts: [product.name, product.brand?.name, product.ingredientsText] })
    : null;
  if (product && petFoodBlock) {
    await rejectProduct(input.productId).catch(() => null);
    // Vises i admin-oversigten til gennemsyn og tæller som forsøg for den, der oprettede varen.
    await recordPetFoodAttempt({
      userId: product.createdByUserId,
      source: "ENRICHMENT",
      kind: "AUTO_REJECTED",
      productId: input.productId,
      productName: product.name,
      imageUrls: input.frontPhotoUrl ? [input.frontPhotoUrl] : undefined,
      matchedBy: `${petFoodBlock.reason}: ${petFoodBlock.match}`,
    });
    await debugLog({
      category: "scan",
      event: "pet_food_rejected",
      level: "warn",
      message: `Varen afvist automatisk: dyrefoder (${petFoodBlock.reason}: ${petFoodBlock.match}) — ${product.name}`,
      productId: input.productId,
    });
  }

  await debugLog({
    category: "scan",
    event: "enrichment_done",
    level: product && product.pendingFields.length === 0 ? "info" : "warn",
    message: product
      ? `Varen er færdig: ${product.brand ? `${product.brand.name} — ` : ""}${product.name} (${product.kcalPer100g} kcal/100)${
          product.pendingFields.length ? ` · stadig ventende felter: ${product.pendingFields.join(", ")}` : ""
        }`
      : "Varen findes ikke længere",
    productId: input.productId,
    durationMs: Date.now() - startedAt,
    data: product ? { pendingFields: product.pendingFields, retry } : { retry },
  });
  return retry;
}

// Ingredienslisten igen på ét bestemt foto (src/lib/quick-enrichment-jobs.ts):
// bruges, når den første aflæsning ikke fandt nogen liste. Et glas har tit
// ingredienserne på bagsidens etiket sammen med stregkoden eller næringen,
// så de andre fotos fra scanningen prøves ét ad gangen. Returnerer true, når
// en liste blev fundet og gemt.
export async function retryIngredients(input: {
  productId: string;
  barcode: string;
  marketRegion: string;
  signals?: unknown;
  photo: string;
  photoUrl: string;
  photoLabel: string;
  ocrText?: string;
}): Promise<boolean> {
  const { productId } = input;
  const startedAt = Date.now();
  try {
    const read = await analyzeIngredientsPhoto({
      photo: input.photo,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
      ocrText: input.ocrText ?? "",
      storedImageUrl: input.photoUrl,
    });
    await prisma.aiProductAnalysis.update({ where: { id: read.analysisId }, data: { productId } });
    await logIngredientsReview(productId, read.result, "AI, nyt forsøg");
    const text = read.result.ingredientsText?.trim() ?? "";
    if (text) {
      // Kun hvis feltet stadig er tomt — en admin eller brugeren kan have
      // udfyldt det imens.
      await prisma.product.updateMany({
        where: { id: productId, OR: [{ ingredientsText: null }, { ingredientsText: "" }] },
        data: { ingredientsText: text },
      });
      await syncProductNutritionFeaturesSafely(productId);
    }
    await debugLog({
      category: "scan",
      event: "enrich_ingredients_retry",
      level: text ? "info" : "warn",
      message: text
        ? `Ingredienser fundet ved nyt forsøg på ${input.photoLabel} (${text.length} tegn)`
        : `Nyt forsøg på ${input.photoLabel}: ingen ingrediensliste fundet`,
      productId,
      durationMs: Date.now() - startedAt,
      data: { photo: input.photoLabel, ingredientsText: text.slice(0, 500) || null, confidence: read.result.confidence },
    });
    return Boolean(text);
  } catch (error) {
    await debugLog({
      category: "scan",
      event: "enrich_ingredients_retry",
      level: "error",
      message: `Nyt forsøg på ingredienserne (${input.photoLabel}) fejlede: ${errorText(error)}`,
      productId,
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
