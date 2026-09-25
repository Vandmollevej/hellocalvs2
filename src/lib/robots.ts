import { prisma } from "@/lib/prisma";
import {
  AMOUNT_SUGGESTION_ROBOT_KEY,
  sanitizeAmountSuggestionSettings,
} from "@/lib/amount-suggestion-config";

// Robotten skriver heartbeat hvert minut (scripts/amount-suggestion-agent);
// uden heartbeat i 5 minutter regnes containeren for at være stoppet.
const HEARTBEAT_STALE_MS = 5 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  FRUIT: "Frugt",
  VEGETABLE: "Grøntsager",
  MEAT: "Kød",
  OTHER: "Andet (løs vare)",
  DRINK: "Drikkevarer",
  VEGETABLES: "Grøntsager (vare)",
  GENERIC: "Generisk vare",
  PROCESSED: "Forarbejdet",
  RAW: "Råvare",
  INGREDIENT: "Ingrediens",
};

export type AmountSuggestionRobotView = Awaited<ReturnType<typeof loadAmountSuggestionRobot>>;

// Alt til robotpanelet (/admin/robots): indstillinger, status fra seneste
// kørsel og de forslag med flest brugere bag.
export async function loadAmountSuggestionRobot() {
  const [config, rows, total] = await Promise.all([
    prisma.robotConfig.findUnique({ where: { key: AMOUNT_SUGGESTION_ROBOT_KEY } }),
    prisma.amountSuggestion.findMany({ orderBy: [{ userCount: "desc" }, { sampleCount: "desc" }], take: 40 }),
    prisma.amountSuggestion.count(),
  ]);

  const productIds = rows.filter((row) => row.itemType === "PRODUCT").map((row) => row.itemId);
  const genericIds = rows.filter((row) => row.itemType === "GENERIC_INGREDIENT").map((row) => row.itemId);
  const [products, generics] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    prisma.genericIngredient.findMany({ where: { id: { in: genericIds } }, select: { id: true, name: true } }),
  ]);
  const names = new Map([...products, ...generics].map((item) => [item.id, item.name]));

  const heartbeatAt = config?.heartbeatAt ?? null;
  return {
    enabled: config?.enabled ?? true,
    settings: sanitizeAmountSuggestionSettings(config?.settings),
    online: Boolean(heartbeatAt && Date.now() - heartbeatAt.getTime() < HEARTBEAT_STALE_MS),
    heartbeatAt: heartbeatAt?.toISOString() ?? null,
    runRequestedAt: config?.runRequestedAt?.toISOString() ?? null,
    lastRunStartedAt: config?.lastRunStartedAt?.toISOString() ?? null,
    lastRunFinishedAt: config?.lastRunFinishedAt?.toISOString() ?? null,
    lastRunStatus: config?.lastRunStatus ?? null,
    lastRunSummary: (config?.lastRunSummary ?? null) as Record<string, number> | null,
    lastError: config?.lastError ?? null,
    suggestionCount: total,
    topSuggestions: rows.map((row) => ({
      id: row.id,
      name: row.itemType.endsWith("_CATEGORY")
        ? `Kategori: ${CATEGORY_LABELS[row.itemId] ?? row.itemId}`
        : (names.get(row.itemId) ?? row.itemId),
      itemId: row.itemId,
      context: row.context,
      grams: row.suggestedGrams,
      p25: row.p25Grams,
      p75: row.p75Grams,
      confidence: row.confidence,
      userCount: row.userCount,
      sampleCount: row.sampleCount,
      method: row.method,
    })),
  };
}
