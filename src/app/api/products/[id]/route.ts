import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveGenericIngredientNutrients, resolveProductNutrients } from "@/lib/nutrient-resolution";
import { isEstimatedSource } from "@/lib/nutrients";
import { getSessionUser } from "@/lib/session";
import {
  PRODUCT_UPDATE_POINTS,
  hasEarnedUpdatePoints,
  productGaps,
  updateKindsFor,
} from "@/lib/product-update";
import { findSubbrandLogoUrl } from "@/lib/subbrand-logo";
import { needsProductTranslation, translationTarget } from "@/lib/product-language";
import { ensureProductLanguage, productTranslationFor } from "@/lib/product-translate";
import { applyProductTexts, productTextsFor, type ProductTranslationInfo } from "@/lib/product-text-swap";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const loadProduct = () => prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        barcodes: true,
        images: { orderBy: { order: "asc" } },
        filters: {
          select: {
            organic: true,
            keyhole: true,
            wholeGrain: true,
            animalWelfare: true,
            certifications: true,
            // Fødevareegenskaber på varen.
            glutenFree: true,
            lactoseFree: true,
            sugarFree: true,
            sweeteners: true,
            vegan: true,
            vegetarian: true,
            meatType: true,
            alcohol: true,
            alcoholPercent: true,
            fatPercent: true,
            countryOfOrigin: true,
            storage: true,
            size: true,
          },
        },
        // Mærkater fra det natlige mærkat-job (docs/DECISIONS.md 2026-10-02).
        labels: {
          select: { key: true, name: true, category: true, imageUrl: true, confidence: true },
          orderBy: { confidence: "desc" },
        },
        nutritionFeatures: {
          select: {
            sugarsPer100g: true,
            sugarSource: true,
            fiberPer100g: true,
            fiberSource: true,
            saltPer100g: true,
            saltSource: true,
          },
        },
      },
    });
    let product = await loadProduct();
    // Kinesisk og andre ikke-latinske tegn vises aldrig (brugerens regel
    // 2026-10-14): varen oversættes til brugerens app-sprog, før den sendes.
    if (
      product &&
      needsProductTranslation([
        product.name,
        product.namePlural,
        product.productType,
        product.variant,
        product.packageSizeText,
        product.ingredientsText,
        product.subbrand,
        product.brand?.name,
      ])
    ) {
      const viewer = await getSessionUser().catch(() => null);
      if (await ensureProductLanguage(id, viewer?.appLocale)) product = await loadProduct();
    }
    // Oversat vare (docs/DECISIONS.md 2026-10-14): teksten på brugerens
    // app-sprog, eller originalen, hvis brugeren har slået oversættelse fra
    // under Visning. Den anden version følger med til "Vis original".
    let translation: ProductTranslationInfo | null = null;
    if (product && (product.textOriginals || product.nameOriginal || product.ingredientsOriginal)) {
      const viewer = await getSessionUser().catch(() => null);
      const info = await productTranslationFor(product, translationTarget(viewer?.appLocale)).catch((error) => {
        console.error("Product translation lookup failed", error);
        return null;
      });
      if (info) {
        const translated = info.overlay ? applyProductTexts(product, info.overlay) : product;
        if (info.sameLanguage) {
          product = translated;
        } else if (viewer?.translateForeignText === false) {
          product = applyProductTexts(product, info.original);
          translation = {
            showing: "original",
            sourceLanguageName: info.sourceLanguageName,
            targetLanguageName: info.targetLanguageName,
            alternate: productTextsFor(translated, Object.keys(info.original)),
          };
        } else {
          product = translated;
          translation = {
            showing: "translated",
            sourceLanguageName: info.sourceLanguageName,
            targetLanguageName: info.targetLanguageName,
            alternate: info.original,
          };
        }
      }
    }
    // En privat ingrediens vises kun for ejeren.
    if (product && product.privateOwnerId) {
      const user = await getSessionUser();
      if (user?.id !== product.privateOwnerId) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
    }
    if (product) {
      // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): alle næringsstoffer
      // ud over makroerne, pr. 100 g, med estimeret-flag.
      const nutrients = await resolveProductNutrients(product).catch((error) => {
        console.error("Nutrient resolution failed", error);
        return [];
      });
      // Brugerens seneste mængde for varen — startmængde i mængdevælgeren
      // (src/lib/default-amount.ts).
      const user = await getSessionUser().catch(() => null);
      const last = user
        ? await prisma.registration.findFirst({
            where: { userId: user.id, productId: product.id },
            orderBy: { createdAt: "desc" },
            select: { amountGrams: true },
          })
        : null;
      // AI kunne ikke læse ingredienslisten på fotoet (docs/DECISIONS.md
      // 2026-10-02): den, der oprettede varen, tilbydes at tage et nyt foto.
      const ingredientsUnreadable =
        !product.ingredientsText?.trim() &&
        !product.pendingFields.includes("ingredients") &&
        !!user &&
        product.createdByUserId === user.id &&
        (await prisma.aiProductAnalysis
          .count({ where: { productId: product.id, kind: "INGREDIENTS" } })
          .then((count) => count > 0)
          .catch(() => false));
      // Opdater-varen-banneret (brugerbeslutning 2026-10-03): mangler indhold,
      // energi, logo eller produktbillede, tilbydes 20 points — også admin.
      const updateKinds =
        user && !product.privateOwnerId && !(await hasEarnedUpdatePoints(user.id, product.id).catch(() => true))
          ? updateKindsFor(productGaps(product))
          : [];
      // Subbrandet står over brandet ved produktcirklen — som logo, hvis det
      // findes (docs/DECISIONS.md 2026-10-10).
      const subbrandLogoUrl = await findSubbrandLogoUrl(product.brand?.name, product.subbrand).catch((error) => {
        console.error("Subbrand logo lookup failed", error);
        return null;
      });
      // Oversættelsernes rådata sendes ikke; translation bærer det, siden skal bruge.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { textOriginals, textTranslations, ...productFields } = product;
      return NextResponse.json({
        product: {
          ...productFields,
          translation,
          subbrandLogoUrl,
          nutrients,
          updateOffer: updateKinds.length ? { kinds: updateKinds, points: PRODUCT_UPDATE_POINTS } : null,
          lastAmountGrams: last?.amountGrams ?? null,
          ingredientsUnreadable,
          // Butiksvare uden kalorietal (docs/DECISIONS.md 2026-10-02): 0 er en
          // pladsholder, så UI viser "Næringsindhold ukendt" i stedet for 0 kcal.
          hasKnownNutrition: !product.nutritionMissing,
          // Frida-skøn (∼, docs/DECISIONS.md 2026-10-10): ∼ ved kalorietallet og
          // Fridas kildeangivelse nederst i næringsfeltet, når en værdi er fra Frida.
          kcalEstimated: isEstimatedSource((product.nutrientSources as Record<string, string> | null)?.kcal),
          fridaSource: !!product.fridaEstimateId || nutrients.some((n) => n.frida),
        },
      });
    }

    // Not a Product — try the separate GenericIngredient table (loose
    // fruit/vegetable/meat with no brand/packaging, see docs/DECISIONS.md
    // 2026-09-19) and reshape it into the same product-like JSON contract, so
    // /add/[id] can display it through the exact same screen. `brand`,
    // `barcodes` and `ingredientsText` are always empty/null — a generic
    // ingredient never has those.
    const ingredient = await prisma.genericIngredient.findUnique({
      where: { id },
      include: { images: { orderBy: { order: "asc" } } },
    });
    if (ingredient) {
      const nutrients = await resolveGenericIngredientNutrients(ingredient).catch(() => []);
      return NextResponse.json({
        product: {
          id: ingredient.id,
          name: ingredient.name,
          kcalPer100g: ingredient.kcalPer100g ?? 0,
          proteinPer100g: ingredient.proteinPer100g ?? 0,
          carbsPer100g: ingredient.carbsPer100g ?? 0,
          fatPer100g: ingredient.fatPer100g ?? 0,
          servingSizeGrams: null,
          servingSizeUnitSingular: null,
          servingSizeUnitPlural: null,
          brand: null,
          imageUrl: ingredient.imageUrl,
          images: ingredient.images,
          ingredientsText: null,
          allergens: [],
          additives: [],
          barcodes: [],
          createdByUserId: ingredient.createdByUserId,
          // Løs ingrediens uden brand/stregkode — altid gram.
          productCategory: "INGREDIENT",
          packageSizeText: null,
          isGenericIngredient: true,
          // Uden et Frida-match har ingrediensen ingen kendt næringsværdi —
          // UI skal vise "–", ikke lade som om 0 er en rigtig målt værdi.
          hasKnownNutrition: ingredient.kcalPer100g !== null,
          nutrients,
        },
      });
    }

    return NextResponse.json({ product: null }, { status: 404 });
  } catch (error) {
    console.error("Product fetch failed", error);
    return NextResponse.json(
      { product: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
