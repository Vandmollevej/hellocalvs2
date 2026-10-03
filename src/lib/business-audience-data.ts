import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";
import {
  computeAudienceProfile,
  PRODUCT_TYPE_DAYS,
  USAGE_DAYS,
  type AudienceProfile,
  type AudienceUser,
} from "@/lib/business-audience";

// Henter rækkerne til "Den typiske bruger" på /business og lader
// business-audience.ts regne. Fejler databasen, vises sektionen uden tal
// (samme princip som forsidens nøgletal, src/lib/landing-stats.ts).

const DAY_MS = 24 * 60 * 60 * 1000;
// Prisma gemmer DateTime som TIMESTAMP(3) uden tidszone (UTC), så datoen
// findes ved først at mærke værdien som UTC og derefter flytte den til dansk tid.
const TIME_ZONE = "Europe/Copenhagen";

type UsageRow = { userId: string; registrations: number; activeDays: number };
type TypeRow = { userId: string; productType: string; count: number };
type WeightRow = { userId: string; firstKg: number; lastKg: number; firstAt: Date; lastAt: Date };

export async function loadBusinessAudience(now: Date = new Date()): Promise<AudienceProfile | null> {
  try {
    const usageSince = new Date(now.getTime() - USAGE_DAYS * DAY_MS);
    const typesSince = new Date(now.getTime() - PRODUCT_TYPE_DAYS * DAY_MS);

    const [users, children, usage, types, weights] = await Promise.all([
      prisma.user.findMany({
        where: { role: "USER" },
        select: { id: true, sex: true, birthDate: true, weightKg: true },
      }),
      prisma.familyMember.findMany({ where: { isChild: true }, select: { userId: true } }),
      prisma.$queryRaw<UsageRow[]>`
        SELECT "userId",
               count(*)::int AS "registrations",
               count(DISTINCT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE})::date)::int AS "activeDays"
        FROM "registrations"
        WHERE "createdAt" >= ${usageSince}
        GROUP BY "userId"`,
      prisma.$queryRaw<TypeRow[]>`
        SELECT r."userId",
               COALESCE(NULLIF(trim(p."productType"), ''),
                        CASE WHEN r."dishId" IS NOT NULL THEN 'Retter'
                             WHEN r."genericIngredientId" IS NOT NULL THEN 'Råvarer'
                             ELSE 'Andet' END) AS "productType",
               count(*)::int AS "count"
        FROM "registrations" r
        LEFT JOIN "products" p ON p."id" = r."productId"
        WHERE r."createdAt" >= ${typesSince}
        GROUP BY 1, 2`,
      prisma.$queryRaw<WeightRow[]>`
        SELECT "userId",
               (array_agg("weightKg" ORDER BY "weighedAt" ASC))[1]  AS "firstKg",
               (array_agg("weightKg" ORDER BY "weighedAt" DESC))[1] AS "lastKg",
               min("weighedAt") AS "firstAt",
               max("weighedAt") AS "lastAt"
        FROM "weight_entries"
        GROUP BY "userId"`,
    ]);

    const childIds = new Set(children.map((c) => c.userId));
    const usageById = new Map(usage.map((row) => [row.userId, row]));
    const weightById = new Map(weights.map((row) => [row.userId, row]));
    const typesById = new Map<string, Record<string, number>>();
    for (const row of types) {
      const counts = typesById.get(row.userId) ?? {};
      counts[row.productType] = (counts[row.productType] ?? 0) + Number(row.count);
      typesById.set(row.userId, counts);
    }

    const audience: AudienceUser[] = users
      .filter((user) => !childIds.has(user.id))
      .map((user) => {
        const use = usageById.get(user.id);
        const weight = weightById.get(user.id);
        const firstWeightKg = weight ? Number(weight.firstKg) : user.weightKg ?? null;
        const lastWeightKg = weight ? Number(weight.lastKg) : user.weightKg ?? null;
        const spanDays = weight ? (new Date(weight.lastAt).getTime() - new Date(weight.firstAt).getTime()) / DAY_MS : 0;
        return {
          id: user.id,
          sex: user.sex ?? null,
          age: computeAge(user.birthDate),
          firstWeightKg,
          lastWeightKg,
          weightSpanDays: spanDays,
          registrations: use ? Number(use.registrations) : 0,
          activeDays: use ? Number(use.activeDays) : 0,
          typeCounts: typesById.get(user.id) ?? {},
        };
      });

    return computeAudienceProfile(audience);
  } catch (error) {
    console.error("[business] typisk bruger kunne ikke beregnes", error);
    return null;
  }
}
