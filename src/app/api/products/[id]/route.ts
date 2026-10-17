import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveGenericIngredientNutrients, resolveProductNutrients } from "@/lib/nutrient-resolution";
import { isEstimatedSource } from "@/lib/nutrients";
import { getSessionUser } from "@/lib/session";
import {
  updatePointsFor,
  hasEarnedUpdatePoints,
  productGaps,
  updateKindsFor,
} from "@/lib/product-update";
import { findSubbrandLogoUrl } from "@/lib/subbrand-logo";
import { applyFridaEstimateTo } from "@/lib/frida-estimates";
import { appLocaleOf, needsTranslation } from "@/lib/product-language";
import { languageName, refreshProductLanguage, translationFor } from "@/lib/product-translations";
import { brandProductName, displayProductName } from "@/lib/product-placeholder-name";
import { nameBrandOnlyProduct, RETRY_ASKED_BEFORE } from "@/lib/product-placeholder-repair";
import { applyProductTexts, productTextsFor, translationPlacement, type ProductTranslationInfo } from "@/lib/product-text-swap";
import { queueStaleExternalEnrichment } from "@/lib/external-enrichment";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const load = () => prisma.product.findUnique({
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
    let product = await load();
    // Vare uden energimærkning: Fridas tal hentes straks, når produkttypen
    // passer, i stedet for først ved natrobotten (DECISIONS 2026-10-16).
    if (product?.nutritionMissing && (await applyFridaEstimateTo(product.id).catch(() => false))) {
      product = await load();
    }
    // Varesiden åbnet: eksterne kilder flettes ind i baggrunden (bruger 2026-10-17).
    if (product && !product.privateOwnerId) queueStaleExternalEnrichment([product.id], "page");
    // En privat ingrediens vises kun for ejeren.
    if (product && product.privateOwnerId) {
      const user = await getSessionUser();
      if (user?.id !== product.privateOwnerId) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
    }
    if (product) {
      // Varens sprog og brugerens oversættelse (docs/DECISIONS.md 2026-10-15):
      // kolonnerne er originalen; står varen på et andet sprog end brugerens
      // app-sprog, sendes oversættelsen i felterne og originalen i
      // translation.alternate til "Vis original". Slået fra under Visning →
      // Oversættelse = originalen uden linjen.
      const viewer = await getSessionUser().catch(() => null);
      const language =
        product.language === null
          ? await refreshProductLanguage(product.id).catch(() => null)
          : product.language;
      let shown = product;
      let translation: ProductTranslationInfo | null = null;
      const viewerLocale = appLocaleOf(viewer?.appLocale);
      if (viewer && viewer.translateForeignText !== false && needsTranslation(language, viewerLocale)) {
        const texts = await translationFor({ ...product, language }, viewerLocale).catch((error) => {
          console.error("Product translation failed", error);
          return null;
        });
        const original = texts ? productTextsFor(product, Object.keys(texts)) : null;
        const placement = texts && original ? translationPlacement(original, texts) : null;
        if (texts && original && placement) {
          shown = applyProductTexts(product, texts);
          translation = {
            showing: "translated",
            sourceLanguageName: languageName(language, viewerLocale),
            targetLanguageName: languageName(viewerLocale, viewerLocale) ?? viewerLocale,
            alternate: original,
            placement,
          };
        }
      }
      // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): alle næringsstoffer
      // ud over makroerne, pr. 100 g, med estimeret-flag.
      const nutrients = await resolveProductNutrients(product).catch((error) => {
        console.error("Nutrient resolution failed", error);
        return [];
      });
      // Brugerens seneste mængde for varen — startmængde i mængdevælgeren
      // (src/lib/default-amount.ts).
      const user = viewer;
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
      // Hedder varen kun brand + subbrand (fx "Verpoorten"), spørges OpenAI om
      // varetypen i baggrunden (fx Eierlikör) — næste visning har navnet
      // (brugerens regel 2026-10-15).
      const brandOnlyName = brandProductName(product.brand?.name, product.subbrand).toLowerCase();
      const plainName = product.name.trim().toLowerCase();
      if (
        !product.externalSource &&
        (!product.productTypeAskedAt || product.productTypeAskedAt < RETRY_ASKED_BEFORE) &&
        !product.pendingFields.includes("name") &&
        product.brand &&
        (!plainName || plainName === brandOnlyName || plainName === product.brand.name.trim().toLowerCase())
      ) {
        void nameBrandOnlyProduct(product.id).catch((error) => console.error("Product type naming failed", product.id, error));
      }
      // Subbrandet står over brandet ved produktcirklen — som logo, hvis det
      // findes (docs/DECISIONS.md 2026-10-10).
      const subbrandLogoUrl = await findSubbrandLogoUrl(product.brand?.name, product.subbrand).catch((error) => {
        console.error("Subbrand logo lookup failed", error);
        return null;
      });
      return NextResponse.json({
        product: {
          ...shown,
          name: displayProductName(shown.name, product.brand?.name, product.subbrand),
          language,
          translation,
          subbrandLogoUrl,
          nutrients,
          updateOffer: updateKinds.length ? { kinds: updateKinds, points: updatePointsFor(product) } : null,
          lastAmountGrams: last?.amountGrams ?? null,
          ingredientsUnreadable,
          // Butiksvare uden kalorietal (docs/DECISIONS.md 2026-10-02): 0 er en
          // pladsholder, så UI viser "Næringsindhold ukendt" i stedet for 0 kcal.
          hasKnownNutrition: !product.nutritionMissing,
          // Frida-skøn (∼, docs/DECISIONS.md 2026-10-10): ∼ ved kalorietallet og
          // Fridas kildeangivelse nederst i næringsfeltet, når en værdi er fra Frida.
          // Aldrig "∼ 0": et skøn på 0 kcal er ingen værdi (bruger 2026-10-16).
          kcalEstimated:
            product.kcalPer100g > 0 && isEstimatedSource((product.nutrientSources as Record<string, string> | null)?.kcal),
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
