import { prisma } from "@/lib/prisma";
import {
  parseProductDatabaseFilters,
  productDatabaseHref,
  type ProductDatabaseSearchParams,
} from "@/lib/admin-product-database-query";

// Gemte visninger i admin (docs/DECISIONS.md 2026-10-07). Hver visning er en
// søgestreng, som den enkelte sides parser normaliserer ved gem, så ukendte
// eller ugyldige værdier aldrig havner i databasen.

export const SAVED_VIEW_SCOPES = ["product-database"] as const;
export type SavedViewScope = (typeof SAVED_VIEW_SCOPES)[number];

export type SavedView = { id: string; name: string; query: string };

export function isSavedViewScope(value: unknown): value is SavedViewScope {
  return typeof value === "string" && (SAVED_VIEW_SCOPES as readonly string[]).includes(value);
}

// Søgestrengen uden "?" og uden side, normaliseret efter sidens egen parser.
export function normalizeSavedViewQuery(scope: SavedViewScope, raw: string): string {
  const params = new URLSearchParams(raw.replace(/^\?/, ""));
  const record: Record<string, string[]> = {};
  for (const [key, value] of params) (record[key] ??= []).push(value);
  switch (scope) {
    case "product-database": {
      const filters = parseProductDatabaseFilters(record as ProductDatabaseSearchParams);
      return productDatabaseHref({ ...filters, page: 1 }).split("?")[1] ?? "";
    }
  }
}

export async function listSavedViews(userId: string, scope: SavedViewScope): Promise<SavedView[]> {
  const rows = await prisma.adminSavedView.findMany({
    where: { userId, scope },
    orderBy: { name: "asc" },
    select: { id: true, name: true, query: true },
  });
  return rows;
}

// Gemmer under navnet; findes navnet allerede, overskrives den visning.
export async function saveSavedView(userId: string, scope: SavedViewScope, rawName: string, rawQuery: string) {
  const name = rawName.trim().slice(0, 60);
  if (!name) throw new Error("Navn mangler");
  const query = normalizeSavedViewQuery(scope, rawQuery.slice(0, 4000));
  return prisma.adminSavedView.upsert({
    where: { userId_scope_name: { userId, scope, name } },
    create: { userId, scope, name, query },
    update: { query },
    select: { id: true, name: true, query: true },
  });
}

export async function deleteSavedView(userId: string, id: string) {
  await prisma.adminSavedView.deleteMany({ where: { id, userId } });
}
