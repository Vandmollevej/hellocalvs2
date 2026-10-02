import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PRODUCT_PAGE_TAG_SETTINGS,
  sanitizeProductPageTagSettings,
  type ProductPageTagSettings,
} from "@/lib/product-page-tags";

// Én række ("default") med admins valg af nøgleord til produktsiden
// (docs/DECISIONS.md 2026-10-02). Mangler rækken, gælder standarden.
export async function getProductPageTagSettings(): Promise<ProductPageTagSettings> {
  try {
    const row = await prisma.productPageTagSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_PRODUCT_PAGE_TAG_SETTINGS;
    return sanitizeProductPageTagSettings({ fields: row.fields, keywords: row.keywords });
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
    create: { id: "default", fields: settings.fields, keywords: settings.keywords, updatedById },
    update: { fields: settings.fields, keywords: settings.keywords, updatedById },
  });
  return settings;
}

// Alle frie nøgleord fra produktarkene med antal varer, til admins valgliste.
export async function listProductKeywordCounts(): Promise<{ keyword: string; count: number }[]> {
  const rows = await prisma.$queryRaw<{ keyword: string; count: bigint }[]>`
    SELECT keyword, COUNT(*)::bigint AS count
    FROM (SELECT DISTINCT id, trim(unnest(keywords)) AS keyword FROM products WHERE "privateOwnerId" IS NULL) AS k
    WHERE keyword <> ''
    GROUP BY keyword
    ORDER BY count DESC, keyword ASC
    LIMIT 1000
  `;
  return rows.map((row) => ({ keyword: row.keyword, count: Number(row.count) }));
}
