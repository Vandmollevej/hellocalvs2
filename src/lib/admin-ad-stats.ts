import { prisma } from "@/lib/prisma";

export type AdStatsRange = "7d" | "30d" | "90d";
export const AD_STATS_RANGES: { id: AdStatsRange; label: string; days: number }[] = [
  { id: "7d", label: "7 dage", days: 7 },
  { id: "30d", label: "30 dage", days: 30 },
  { id: "90d", label: "90 dage", days: 90 },
];

export type AdStatsRow = { key: string; impressions: number; clicks: number; ctr: number };

type RawRow = { partner: string; location: string; placement: string; type: string; count: bigint };

function ctr(impressions: number, clicks: number) {
  return impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
}

// Læser partner-reklamernes tabeller (ad_locations/ad_events/partners) med
// rå SQL, så Reklamer-fanen ikke er bundet til Prisma-modellen, som ejes af
// Partnere-arbejdet. Findes tabellerne ikke endnu, vises tomme tal.
export async function loadAdStats(range: AdStatsRange) {
  const days = AD_STATS_RANGES.find((r) => r.id === range)?.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let rows: RawRow[] = [];
  try {
    rows = await prisma.$queryRaw<RawRow[]>`
      SELECT p."name" AS partner, l."name" AS location, l."placement" AS placement, e."type"::text AS type, COUNT(*) AS count
      FROM "ad_events" e
      JOIN "ad_locations" l ON l."id" = e."locationId"
      JOIN "partners" p ON p."id" = l."partnerId"
      WHERE e."createdAt" >= ${since}
      GROUP BY p."name", l."name", l."placement", e."type"`;
  } catch {
    rows = [];
  }

  const build = (pick: (r: RawRow) => string) => {
    const map = new Map<string, { impressions: number; clicks: number }>();
    for (const r of rows) {
      const key = pick(r) || "(ingen)";
      const row = map.get(key) ?? { impressions: 0, clicks: 0 };
      if (r.type === "CLICK") row.clicks += Number(r.count);
      else row.impressions += Number(r.count);
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([key, v]): AdStatsRow => ({ key, ...v, ctr: ctr(v.impressions, v.clicks) }))
      .sort((a, b) => b.impressions - a.impressions);
  };

  const byAd = build((r) => `${r.partner} · ${r.location}`);
  const byPlacement = build((r) => r.placement);
  const impressions = byAd.reduce((sum, r) => sum + r.impressions, 0);
  const clicks = byAd.reduce((sum, r) => sum + r.clicks, 0);
  return { impressions, clicks, ctr: ctr(impressions, clicks), byAd, byPlacement };
}
