import { prisma } from "@/lib/prisma";
import { certificationBadges, type CertificationFilters, type CertificationKind } from "@/lib/certification-badges";

// Admin "Produkt-database → Labels": alle mærker (Økologisk, MSC, Nøglehul …)
// der står i ProductFilters, med antal varer pr. mærke. Kilden er de samme
// felter som varesidens certifikat-logoer (src/lib/certification-badges.ts).

export type AdminLabelRow = { label: string; kind: CertificationKind; productCount: number };

type CountRow = { value: string; count: bigint };

export async function loadAdminLabels(): Promise<AdminLabelRow[]> {
  const [organic, keyhole, wholeGrain, animalWelfare, certifications] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT organic AS value, COUNT(*) AS count FROM product_filters WHERE organic IS NOT NULL AND organic <> '' GROUP BY organic`,
    prisma.$queryRaw<CountRow[]>`SELECT keyhole AS value, COUNT(*) AS count FROM product_filters WHERE keyhole IS NOT NULL AND keyhole <> '' GROUP BY keyhole`,
    prisma.$queryRaw<CountRow[]>`SELECT "wholeGrain" AS value, COUNT(*) AS count FROM product_filters WHERE "wholeGrain" IS NOT NULL AND "wholeGrain" <> '' GROUP BY "wholeGrain"`,
    prisma.$queryRaw<CountRow[]>`SELECT v AS value, COUNT(*) AS count FROM product_filters, unnest("animalWelfare") AS v WHERE v <> '' GROUP BY v`,
    prisma.$queryRaw<CountRow[]>`SELECT v AS value, COUNT(*) AS count FROM product_filters, unnest(certifications) AS v WHERE v <> '' GROUP BY v`,
  ]);

  const byLabel = new Map<string, AdminLabelRow>();
  const add = (rows: CountRow[], field: keyof CertificationFilters) => {
    for (const row of rows) {
      const value = row.value.trim();
      if (!value) continue;
      const badge = certificationBadges({ [field]: field === "animalWelfare" || field === "certifications" ? [value] : value })[0];
      if (!badge) continue;
      const key = badge.label.toLowerCase();
      const existing = byLabel.get(key);
      const count = Number(row.count);
      if (existing) existing.productCount += count;
      else byLabel.set(key, { label: badge.label, kind: badge.kind, productCount: count });
    }
  };
  add(organic, "organic");
  add(keyhole, "keyhole");
  add(wholeGrain, "wholeGrain");
  add(animalWelfare, "animalWelfare");
  add(certifications, "certifications");

  return [...byLabel.values()].sort((a, b) => b.productCount - a.productCount || a.label.localeCompare(b.label, "da"));
}
