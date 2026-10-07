import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PRODUCT_PAGE_TAG_SETTINGS,
  sanitizeProductPageTagSettings,
  type ProductPageTagSettings,
} from "@/lib/product-page-tags";

// Én række ("default") med admins valg af nøgleordstyper til produktsiden
// (docs/DECISIONS.md 2026-10-02). Mangler rækken, gælder standarden.
export async function getProductPageTagSettings(): Promise<ProductPageTagSettings> {
  try {
    const row = await prisma.productPageTagSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_PRODUCT_PAGE_TAG_SETTINGS;
    // Kolonnen keywords rummer gruppenavnene (product-keyword-groups.ts).
    return sanitizeProductPageTagSettings({ fields: row.fields, groups: row.keywords });
  } catch (error) {
    // Fx før migrationen er kørt — produktsiden må aldrig fejle på grund af dette.
    console.error("Failed to read product page tag settings", error);
    return DEFAULT_PRODUCT_PAGE_TAG_SETTINGS;
  }
}

export async function saveProductPageTagSettings(
  value: unknown,
  updatedById: string | null,
): Promise<ProductPageTagSettings> {
  const settings = sanitizeProductPageTagSettings(value);
  await prisma.productPageTagSettings.upsert({
    where: { id: "default" },
    // Kolonnen keywords rummer gruppenavnene, ikke enkelte nøgleord.
    create: { id: "default", fields: settings.fields, keywords: settings.groups, updatedById },
    update: { fields: settings.fields, keywords: settings.groups, updatedById },
  });
  return settings;
}

// Alle frie nøgleord på katalogvarer med antal varer, til admins oversigt
// over hvad hver gruppe indeholder.
export async function listProductKeywordCounts(): Promise<{ keyword: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ keyword: string; count: bigint }[]>`
    SELECT keyword, COUNT(*)::bigint AS count
    FROM (SELECT DISTINCT id, trim(unnest(keywords)) AS keyword FROM products WHERE "privateOwnerId" IS NULL) AS k
    WHERE keyword <> ''
    GROUP BY keyword
    ORDER BY count DESC, keyword ASC
    LIMIT 5000
  `;
  return rows.map((row) => ({ keyword: row.keyword, count: Number(row.count) }));
}
