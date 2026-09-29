import { prisma } from "@/lib/prisma";

export type AdStatsRange = "7d" | "30d" | "90d";
export const AD_STATS_RANGES: { id: AdStatsRange; label: string; days: number }[] = [
  { id: "7d", label: "7 dage", days: 7 },
  { id: "30d", label: "30 dage", days: 30 },
  { id: "90d", label: "90 dage", days: 90 },
];

export type AdStatsRow = { key: string; impressions: number; clicks: number; ctr: number };

function ctr(impressions: number, clicks: number) {
  return impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
}

export async function loadAdStats(range: AdStatsRange) {
  const days = AD_STATS_RANGES.find((r) => r.id === range)?.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const grouped = await prisma.adEvent.groupBy({
    by: ["adKey", "placement", "type"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  const build = (pick: (g: (typeof grouped)[number]) => string) => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    for (const g of grouped) {
      const key = pick(g) || "(ingen)";
      const row = map.get(key) ?? { impressions: 0, clicks: 0 };
      if (g.type === "CLICK") row.clicks += g._count._all;
      else row.impressions += g._count._all;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([key, v]): AdStatsRow => ({ key, ...v, ctr: ctr(v.impressions, v.clicks) }))
      .sort((a, b) => b.impressions - a.impressions);
  };

  const byAd = build((g) => g.adKey);
  const byPlacement = build((g) => g.placement);
  const impressions = byAd.reduce((sum, r) => sum + r.impressions, 0);
  const clicks = byAd.reduce((sum, r) => sum + r.clicks, 0);
  return { impressions, clicks, ctr: ctr(impressions, clicks), byAd, byPlacement };
}
