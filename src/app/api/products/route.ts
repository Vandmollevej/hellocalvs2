import { NextResponse } from "next/server";
import { ExternalProductSource, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchOpenFoodFacts } from "@/lib/openFoodFacts";
import { inferGs1OriginCountryCode } from "@/lib/regions";
import { getSessionUser } from "@/lib/session";
import { flagSimultaneousDuplicates } from "@/lib/product-duplicates";
import { deriveIsVerified, rankProducts } from "@/lib/product-search-ranking";
import { getActiveSearchRankingWeights } from "@/lib/search-ranking-config";
import { cleanAlternativeServings } from "@/lib/alternative-servings";
import { flagUncertainAlternativeServings } from "@/lib/alternative-servings-review";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { composeProductName } from "@/lib/product-naming";
import { isProductCategory } from "@/lib/product-display-unit";

// Fetches Open Food Facts products globally live for search terms without enough local
// results, and saves them as PENDING (same pattern as the barcode lookup in
// /api/products/lookup/[barcode]), so they can be searched again without a new live call.
async function importMatchingOffProducts(q: string) {
  try {
    const offProducts = await searchOpenFoodFacts(q);
    for (const offProduct of offProducts) {
      const existing = await prisma.barcode.findUnique({ where: { code: offProduct.barcode } });
      if (existing) continue;

      const brand = offProduct.brand
        ? await prisma.brand.upsert({
            where: { name: offProduct.brand },
            update: {},
            create: { name: offProduct.brand },
          })
        : null;

      const created = await prisma.product.create({
        data: {
          name: offProduct.name,
          brandId: brand?.id,
          imageUrl: offProduct.imageUrl,
          kcalPer100g: offProduct.kcalPer100g,
          proteinPer100g: offProduct.proteinPer100g,
          carbsPer100g: offProduct.carbsPer100g,
          fatPer100g: offProduct.fatPer100g,
          servingSizeGrams: offProduct.servingSizeGrams,
          ingredientsText: offProduct.ingredientsText,
          allergens: offProduct.allergens,
          additives: offProduct.additives,
          saturatedFatPer100g: offProduct.saturatedFatPer100g,
          unsaturatedFatPer100g: offProduct.unsaturatedFatPer100g,
          transFatPer100g: offProduct.transFatPer100g,
          cholesterolPer100g: offProduct.cholesterolPer100g,
          vitaminAPer100g: offProduct.vitaminAPer100g,
          vitaminCPer100g: offProduct.vitaminCPer100g,
          nutritionExtra: offProduct.nutritionExtraPer100 ?? undefined,
          packageSizeText: offProduct.packageSizeText ?? undefined,
          externalSource: "OPEN_FOOD_FACTS",
          externalId: offProduct.barcode,
          sourceCheckedAt: new Date(),
          originCountryCode: inferGs1OriginCountryCode(offProduct.barcode),
          status: "PENDING",
          barcodes: { create: { code: offProduct.barcode } },
        },
      });
      await syncProductNutritionFeaturesSafely(created.id);
    }
  } catch (error) {
    // Live OFF search is a supplement — does not fail the actual product search.
    console.error("Open Food Facts search import failed", error);
  }
}

// GET /api/products?q=rugbrød — search in our own product database, supplemented by
// a global live search in Open Food Facts if local results are
// sparse. Results are ranked by src/lib/product-search-ranking.ts: text match
// is always dominant, and hidden regional search/click/hour-of-day statistics
// plus GS1 origin/market only reorder otherwise-comparable matches (see
// docs/DECISIONS.md, 2026-09-19). Live autosuggest deliberately starts at 2
// typed characters (?q= with 1 character returns an empty list).
// ?source=HELLOFRESH filters to a single external source (e.g. to browse the entire
// HelloFresh catalog); ?take=N overrides the default limit of 20 (max 200).
// ?hour=0..23 overrides the ranking's local-hour bucket (defaults to the
// server's current hour) — used by the client to send the *browser's* local
// hour so region×time ranking reflects the user, not the server.
// HelloFresh dishes are deliberately excluded unless ?source=HELLOFRESH is passed
// explicitly — they must stay discoverable only via the dedicated dish-recognition
// flow (/api/ai/recognize-hellofresh), not through ordinary Madvarer/Søg search.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const sourceParam = params.get("source")?.trim();
  const source =
    sourceParam && sourceParam in ExternalProductSource
      ? (sourceParam as ExternalProductSource)
      : undefined;
  const take = Math.min(Math.max(parseInt(params.get("take") ?? "20", 10) || 20, 1), 200);
  const requestedHour = Number(params.get("hour"));
  const localHour =
    Number.isInteger(requestedHour) && requestedHour >= 0 && requestedHour <= 23
      ? requestedHour
      : new Date().getHours();

  if (q.length === 1 && !source) {
    return NextResponse.json({ products: [], minQueryLength: 2 });
  }

  try {
    // Ranking re-sorts a wider candidate pool than `take`, since a
    // low-popularity-but-exact match further down createdAt-order must still
    // be able to surface once ranked.
    const candidateTake = q ? Math.max(take * 6, 80) : take;
    const findProducts = () =>
      prisma.product.findMany({
        where: {
          discontinued: false,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { brand: { name: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
          ...(source
            ? { externalSource: source }
            : { OR: [{ externalSource: null }, { externalSource: { not: "HELLOFRESH" } }] }),
        },
        include: {
          // Altid samme include-form (ikke betinget på q/source), så Prisma's
          // udledte returtype er ét fast skema — undgår en union-type der
          // ellers ville kræve en cast for hver adgang nedenfor. De ekstra
          // felter bruges kun i søge-grenen (q && !source), men er billige
          // at hente for de få kandidater de øvrige grene henter.
          brand: { include: { regionSearchStats: true } },
          barcodes: true,
          regionSearchStats: true,
          regionHourStats: true,
          // Verificerings-signal (Søgealgoritmer, 2026-09-19): kun
          // billed-*antal*, aldrig selve billederne.
          _count: { select: { images: true } },
          aiAnalyses: { select: { kind: true } },
        },
        take: candidateTake,
        orderBy: { createdAt: "desc" },
      });

    let products = await findProducts();
    // docs/PRIVACY.md: personlig søgehistorik ligger i brugerens boks.
    // Med ?personal=1 returneres dobbelt så mange kandidater med en
    // rankScore, så enheden selv kan lægge den personlige vægt til og
    // sortere igen (src/lib/vault/handlers/search.ts). Serveren ser aldrig
    // historikken.
    const personalRank = params.get("personal") === "1";
    let personalHistoryWeight: number | null = null;
    const scoreById = new Map<string, number>();

    if (q.length >= 2 && products.length < 10 && !source) {
      await importMatchingOffProducts(q);
      products = await findProducts();
    }

    if (q && !source) {
      const sessionUser = await getSessionUser();
      const region = sessionUser?.region ?? "DK";
      const weights = await getActiveSearchRankingWeights();
      if (personalRank) personalHistoryWeight = weights.personalHistory;

      const rankable = products.map((product) => ({
        ...product,
        isVerified: deriveIsVerified({
          barcodeCount: product.barcodes.length,
          imageCount: product._count?.images ?? 0,
          aiAnalyses: product.aiAnalyses,
        }),
        brandRegionStats: product.brand?.regionSearchStats,
        entityBias: -1, // "Generiske ingredienser vs. varer" — et rigtigt Product
      }));

      const ranked = rankProducts(rankable, q, region, localHour, personalRank ? take * 2 : take, weights);
      for (const entry of ranked) scoreById.set(entry.product.id, entry.score);
      products = ranked.map((entry) => entry.product);

      // Impressions: every ranked result shown to the user counts as a
      // regional "search" for that product/brand, feeding the popularity
      // signal above for future queries. Never blocks the response.
      if (products.length > 0) {
        const now = new Date();
        await prisma.$transaction([
          ...products.map((product) =>
            prisma.productRegionSearchStat.upsert({
              where: { productId_region: { productId: product.id, region } },
              create: {
                productId: product.id,
                region,
                searchCount: 1,
                lastSearchedAt: now,
              },
              update: {
                searchCount: { increment: 1 },
                lastSearchedAt: now,
              },
            })
          ),
          ...products
            .filter((product) => product.brandId)
            .map((product) =>
              prisma.brandRegionSearchStat.upsert({
                where: { brandId_region: { brandId: product.brandId as string, region } },
                create: {
                  brandId: product.brandId as string,
                  region,
                  searchCount: 1,
                  lastSearchedAt: now,
                },
                update: { searchCount: { increment: 1 }, lastSearchedAt: now },
              })
            ),
        ]);
      }
    } else if (products.length > take) {
      products = products.slice(0, take);
    }

    // Hidden ranking statistics/origin data are internal and must never be
    // exposed to users (design.md, docs/DECISIONS.md 2026-09-19).
    const publicProducts = products.map((product) => {
      /* eslint-disable @typescript-eslint/no-unused-vars -- deliberately stripped, never sent to the client */
      const {
        regionSearchStats,
        regionHourStats,
        originCountryCode,
        aiAnalyses,
        isVerified,
        brandRegionStats,
        personalSearchCount,
        personalClickCount,
        entityBias,
        _count,
        ...publicProduct
      } = product as typeof product & {
        regionSearchStats?: unknown;
        regionHourStats?: unknown;
        aiAnalyses?: unknown;
        isVerified?: unknown;
        brandRegionStats?: unknown;
        personalSearchCount?: unknown;
        personalClickCount?: unknown;
        entityBias?: unknown;
        _count?: unknown;
      };
      /* eslint-enable @typescript-eslint/no-unused-vars */
      // Mærkets egen hidden region-popularitet (brandRegionStats' kilde,
      // se ovenfor) må heller aldrig lække til klienten.
      const brand = publicProduct.brand
        ? // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately stripped, never sent to the client
          (({ regionSearchStats, ...publicBrand }) => publicBrand)(publicProduct.brand)
        : publicProduct.brand;
      return { ...publicProduct, brand, ...(personalRank ? { rankScore: scoreById.get(product.id) ?? 0 } : {}) };
    });

    return NextResponse.json({
      products: publicProducts,
      minQueryLength: 2,
      ...(personalRank ? { personalHistoryWeight } : {}),
    });
  } catch (error) {
    console.error("Product search failed", error);
    return NextResponse.json(
      { products: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

function parsePositiveNumber(value: unknown): number | null {
  const num = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function cleanOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// analysisIds kommer fra det guidede barcode-first kamera-flow (draften i
// src/lib/product-draft.ts) — id'er på de AiProductAnalysis-rækker, der blev
// oprettet ved hver AI-analyse (forside/ingredienser/næring). Kun kendte
// nøgler/streng-værdier accepteres fra klienten.
function cleanAnalysisIds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string>;
  const source = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ["front", "ingredients", "nutrition", "barcode"]) {
    if (typeof source[key] === "string" && source[key]) out[key] = source[key] as string;
  }
  return out;
}

// POST /api/products — create a product manually, e.g. from a photo of a
// nutrition label, or from the guided barcode-first AI flow (see
// /camera/create). Created as PENDING, the same status as other
// user-contributed products (see docs/ADMIN.md).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  // brand/subbrand/variant/packageSizeText (docs/DECISIONS.md, 2026-09-17):
  // brand = hovedmærke/logo, subbrand = produktserie, variant = smag/type/
  // styrke — bevidst adskilt fra selve produktnavnet.
  const brandName = cleanOptionalString(body.brand);
  const subbrand = cleanOptionalString(body.subbrand);
  const variant = cleanOptionalString(body.variant);
  const packageSizeText = cleanOptionalString(body.packageSizeText);
  // Manuel "Nyt produkt" (docs/DECISIONS.md 2026-09-23) sender ingen name,
  // men en productType — name sammensættes så af Sub brand + Produkttype +
  // Variant. Andre flows sender fortsat et eksplicit name.
  const productType = cleanOptionalString(body.productType);
  // Produktkategori (docs/DECISIONS.md 2026-09-24) styrer mængdeenheden
  // (drikkevare = ml/cl, ellers g). Ukendte værdier ignoreres (= g).
  const productCategory = isProductCategory(body.productCategory) ? body.productCategory : null;
  const explicitName = typeof body.name === "string" ? body.name.trim() : "";
  const name =
    explicitName || (productType ? composeProductName({ subbrand, productType, variant }) : "");

  const kcalPer100g = parsePositiveNumber(body.kcalPer100g);
  const proteinPer100g = parsePositiveNumber(body.proteinPer100g);
  const carbsPer100g = parsePositiveNumber(body.carbsPer100g);
  const fatPer100g = parsePositiveNumber(body.fatPer100g);
  const servingSizeGrams = parsePositiveNumber(body.servingSizeGrams);
  const servingSizeUnitSingular =
    typeof body.servingSizeUnitSingular === "string" ? body.servingSizeUnitSingular.trim() : "";
  const servingSizeUnitPlural =
    typeof body.servingSizeUnitPlural === "string" ? body.servingSizeUnitPlural.trim() : "";
  const ingredientsText = typeof body.ingredientsText === "string" ? body.ingredientsText.trim() : "";
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  const extraImages = Array.isArray(body.extraImages)
    ? body.extraImages.filter((img): img is string => typeof img === "string")
    : [];
  const analysisIds = cleanAnalysisIds(body.analysisIds);
  // Alternative kalorievisninger (per glas/skive/stk. osv.) fundet af
  // /api/ai/extract-nutrition-v2 på selve emballagen — se
  // docs/DECISIONS.md 2026-09-19.
  const alternativeServings = cleanAlternativeServings(body.alternativeServings);

  if (!name || kcalPer100g === null || proteinPer100g === null || carbsPer100g === null || fatPer100g === null) {
    return NextResponse.json(
      { message: "Navn, kalorier, protein, kulhydrat og fedt skal udfyldes med gyldige tal" },
      { status: 400 }
    );
  }

  if (barcode) {
    const existingBarcode = await prisma.barcode.findUnique({ where: { code: barcode } });
    if (existingBarcode) {
      return NextResponse.json(
        { message: "Stregkoden er allerede knyttet til et andet produkt" },
        { status: 409 }
      );
    }
  }

  try {
    // Points (docs/DECISIONS.md 2026-09-02) kræver at vide hvem der rent
    // faktisk indsendte produktet — kun sat når brugeren er logget ind med
    // en rigtig session (ikke den delte demo-bruger), ellers forbliver
    // createdByUserId null og produktet giver ingen points ved godkendelse.
    const sessionUser = await getSessionUser();
    // Brand-normalisering (docs/DECISIONS.md, 2026-09-17): AI'ens brandforslag
    // upsertes mod eksisterende Brand-rækker case-sensitivt for nu — en
    // separat BrandAlias-tabel er en senere opgave, ikke prompt-hardcoding.
    const brand = brandName
      ? await prisma.brand.upsert({
          where: { name: brandName },
          update: {},
          create: { name: brandName },
        })
      : null;

    const product = await prisma.product.create({
      data: {
        name,
        brandId: brand?.id,
        subbrand,
        variant,
        packageSizeText,
        productType,
        productCategory,
        kcalPer100g,
        proteinPer100g,
        carbsPer100g,
        fatPer100g,
        servingSizeGrams: servingSizeGrams ?? undefined,
        // Enhedsnavnet gemmes kun, når portionsstørrelsen faktisk er angivet
        // og begge bøjningsformer er udfyldt — ellers skal UI falde tilbage
        // til kcal/100g i stedet for at gætte en enhed.
        servingSizeUnitSingular:
          servingSizeGrams && servingSizeUnitSingular && servingSizeUnitPlural
            ? servingSizeUnitSingular
            : undefined,
        servingSizeUnitPlural:
          servingSizeGrams && servingSizeUnitSingular && servingSizeUnitPlural
            ? servingSizeUnitPlural
            : undefined,
        ingredientsText: ingredientsText || undefined,
        alternativeServings: alternativeServings.length
          ? (alternativeServings as unknown as Prisma.InputJsonValue)
          : undefined,
        imageUrl,
        originCountryCode: barcode ? inferGs1OriginCountryCode(barcode) : undefined,
        createdByUserId: sessionUser?.id,
        ...(barcode ? { barcodes: { create: { code: barcode } } } : {}),
        ...(extraImages.length
          ? { images: { create: extraImages.map((url, order) => ({ url, order })) } }
          : {}),
      },
    });
    await flagSimultaneousDuplicates(product.id, product.name, product.createdAt);
    await flagUncertainAlternativeServings(product.id, product.name, alternativeServings);

    // Ground-truth feedback-loop (docs/DECISIONS.md, 2026-09-17): kobl hver
    // AI-analyse fra det guidede flow til det oprettede produkt og gem
    // brugerens endelige (evt. rettede) værdier som correction. prediction
    // (analysens oprindelige AI-svar) er allerede gemt uændret af analyse-
    // routen — kun productId/correction/correctedAt opdateres her.
    const correctedAt = new Date();

    if (analysisIds.front) {
      await prisma.aiProductAnalysis.updateMany({
        where: { id: analysisIds.front, kind: "FRONT" },
        data: {
          productId: product.id,
          correction: {
            brand: brandName ?? null,
            subbrand: subbrand ?? null,
            productName: name,
            variant: variant ?? null,
            packageSizeText: packageSizeText ?? null,
          },
          correctedAt,
        },
      });
    }

    if (analysisIds.ingredients) {
      await prisma.aiProductAnalysis.updateMany({
        where: { id: analysisIds.ingredients, kind: "INGREDIENTS" },
        data: {
          productId: product.id,
          correction: { ingredientsText: ingredientsText || null },
          correctedAt,
        },
      });
    }

    if (analysisIds.nutrition) {
      await prisma.aiProductAnalysis.updateMany({
        where: { id: analysisIds.nutrition, kind: "NUTRITION" },
        data: {
          productId: product.id,
          correction: { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g, alternativeServings },
          correctedAt,
        },
      });
    }

    // Stregkode-fotoet har ingen AI-korrektion (ingen AI-kald involveret, se
    // POST /api/ai/save-barcode-photo) — kun productId sættes, så den lokale
    // kvalitetskontrol-agent (scripts/quality-control-agent) kan finde den.
    if (analysisIds.barcode) {
      await prisma.aiProductAnalysis.updateMany({
        where: { id: analysisIds.barcode, kind: "BARCODE" },
        data: { productId: product.id, correctedAt },
      });
    }

    // Normaliserede søgeparametre (fiber-%, sukker-%, fuldkorn …) ud fra den
    // nu tilknyttede næringsanalyse og ingredienslisten (docs/DECISIONS.md
    // 2026-09-23).
    await syncProductNutritionFeaturesSafely(product.id);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
