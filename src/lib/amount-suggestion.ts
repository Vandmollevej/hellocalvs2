import type { AmountContext } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AMOUNT_SUGGESTION_ROBOT_KEY,
  sanitizeAmountSuggestionSettings,
  type AmountSuggestionSettings,
} from "@/lib/amount-suggestion-config";
import { combineAmounts, roundSuggestedAmount, type GlobalAmount } from "@/lib/amount-suggestion-math";

export async function getAmountSuggestionSettings(): Promise<{
  enabled: boolean;
  settings: AmountSuggestionSettings;
}> {
  const config = await prisma.robotConfig.findUnique({ where: { key: AMOUNT_SUGGESTION_ROBOT_KEY } });
  return {
    enabled: config?.enabled ?? true,
    settings: sanitizeAmountSuggestionSettings(config?.settings),
  };
}

// Den mest sandsynlige mængde for én bruger og én vare: robottens fælles
// tal for varen (eller dens kategori, når varen har for få data) blandet
// med brugerens egne seneste valg i samme kontekst. null = ingen data;
// siden bruger så sin gamle standard (100 g / 1 portion).
export async function suggestAmount(params: {
  userId: string | null;
  itemId: string;
  context: AmountContext;
}) {
  const { enabled, settings } = await getAmountSuggestionSettings();
  if (!enabled || !settings.useInApp) return null;

  const product = await prisma.product.findUnique({
    where: { id: params.itemId },
    select: { id: true, productCategory: true, servingSizeGrams: true },
  });
  const generic = product
    ? null
    : await prisma.genericIngredient.findUnique({
        where: { id: params.itemId },
        select: { id: true, category: true },
      });
  if (!product && !generic) return null;

  const itemType = product ? "PRODUCT" : "GENERIC_INGREDIENT";
  const categoryKey = product
    ? product.productCategory && { itemType: "PRODUCT_CATEGORY", itemId: product.productCategory }
    : { itemType: "GENERIC_CATEGORY", itemId: generic!.category };

  const [itemRow, categoryRow, recentGrams] = await Promise.all([
    prisma.amountSuggestion.findUnique({
      where: { itemType_itemId_context: { itemType, itemId: params.itemId, context: params.context } },
    }),
    categoryKey
      ? prisma.amountSuggestion.findUnique({
          where: { itemType_itemId_context: { ...categoryKey, context: params.context } },
        })
      : null,
    params.userId ? recentOwnAmounts(params.userId, params.itemId, params.context, settings.personalHistory) : [],
  ]);

  const globalRow = itemRow ?? categoryRow;
  const global: GlobalAmount | null = globalRow
    ? { grams: globalRow.suggestedGrams, confidence: globalRow.confidence }
    : null;
  const estimate = combineAmounts(recentGrams, global, settings.personalWeight);
  if (!estimate) return null;

  return {
    grams: roundSuggestedAmount(estimate.grams, product?.servingSizeGrams),
    source: estimate.source === "global" && !itemRow ? ("category" as const) : estimate.source,
    confidence: Math.round(estimate.confidence * 100) / 100,
  };
}

async function recentOwnAmounts(userId: string, itemId: string, context: AmountContext, take: number) {
  if (context === "RECIPE") {
    const rows = await prisma.dishIngredient.findMany({
      where: { productId: itemId, dish: { ownerId: userId } },
      orderBy: { dish: { createdAt: "desc" } },
      select: { grams: true },
      take,
    });
    return rows.map((row) => row.grams);
  }
  const rows = await prisma.registration.findMany({
    where: { userId, OR: [{ productId: itemId }, { genericIngredientId: itemId }] },
    orderBy: { createdAt: "desc" },
    select: { amountGrams: true },
    take,
  });
  return rows.map((row) => row.amountGrams);
}
