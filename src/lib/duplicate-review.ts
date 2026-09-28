import { Prisma, type ExternalProductSource, type ProductCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DUPLICATE_FIELDS,
  FILTER_LIST_KEYS,
  FILTER_NUMBER_KEYS,
  FILTER_TEXT_KEYS,
  isEmptyValue,
  sameValue,
  sourceRecordValues,
  type DuplicateFieldValue,
  type DuplicateFieldValues,
} from "@/lib/duplicate-fields";

// Admin "Dubletter" (docs/DECISIONS.md 2026-09-28). To faner:
// - Produktbilleder: varer med flere billed-varianter fra importen (EAN.png,
//   EAN_2.png …) eller efter en fletning — vist på én linje.
// - Produkter: grupper på op til 6 kolonner, én er "Endelig". Kilder:
//   (1) Bilka + REMA 1000 med samme stregkode men forskellige felter
//       (ProductSourceRecord), (2) samtidige dobbeltoprettelser
//       (ProductDuplicateLink, src/lib/product-duplicates.ts) og (3) varer med
//       samme navn, brand og mængde.

export const MAX_COLUMNS = 6;
export const GROUPS_PER_PAGE = 20;
// Tags på product_images: "Import" = butiksimportens varianter
// (scripts/store-products-import), "Flettet" = flyttet over ved en fletning.
export const REVIEW_IMAGE_TAGS = ["Import", "Flettet"];

const SOURCE_LABELS: Partial<Record<ExternalProductSource, string>> = {
  BILKA: "Bilka",
  REMA1000: "REMA 1000",
  OPEN_FOOD_FACTS: "Open Food Facts",
  FRIDA: "Frida",
  HELLOFRESH: "HelloFresh",
  USDA: "USDA",
};

export const productCompareInclude = {
  brand: true,
  barcodes: true,
  stores: { include: { store: true } },
  nutritionFeatures: true,
  filters: true,
  images: { orderBy: { order: "asc" } },
} satisfies Prisma.ProductInclude;

type CompareProduct = Prisma.ProductGetPayload<{ include: typeof productCompareInclude }>;

export function productFieldValues(p: CompareProduct): DuplicateFieldValues {
  const n = p.nutritionFeatures;
  const f = p.filters;
  const values: DuplicateFieldValues = {
    imageUrl: p.imageUrl ?? p.images[0]?.url ?? null,
    name: p.name,
    brand: p.brand?.name ?? null,
    subbrand: p.subbrand,
    productType: p.productType,
    variant: p.variant,
    flavor: p.flavor,
    packageSizeText: p.packageSizeText,
    packCount: p.packCount,
    productCategory: p.productCategory,
    barcodes: p.barcodes.map((b) => b.code),
    stores: p.stores.map((s) => s.store.name),
    keywords: p.keywords,
    ingredientsText: p.ingredientsText,
    allergens: p.allergens,
    additives: p.additives,
    kcal: p.kcalPer100g,
    energyKj: n?.energyKjPer100g ?? null,
    protein: p.proteinPer100g,
    carbs: p.carbsPer100g,
    sugars: n?.sugarsPer100g ?? null,
    fat: p.fatPer100g,
    saturatedFat: p.saturatedFatPer100g,
    fiber: n?.fiberPer100g ?? null,
    salt: n?.saltPer100g ?? null,
  };
  for (const key of FILTER_TEXT_KEYS) values[key] = f?.[key] ?? null;
  for (const key of FILTER_NUMBER_KEYS) values[key] = f?.[key] ?? null;
  for (const key of FILTER_LIST_KEYS) values[key] = f?.[key] ?? [];
  return values;
}

export type CompareColumn = {
  id: string;
  title: string;
  subtitle: string;
  // Kun produkt-kolonner kan vælges som "Endelig"; butiks-kolonner er kilder.
  productId: string | null;
  values: DuplicateFieldValues;
};

export type CompareGroup = {
  key: string;
  kind: "sources" | "products";
  reason: string;
  columns: CompareColumn[];
  // Kolonnen der som udgangspunkt er den endelige.
  finalColumnId: string;
  hiddenCount: number;
};

function productColumn(p: CompareProduct): CompareColumn {
  const source = p.externalSource ? SOURCE_LABELS[p.externalSource] ?? p.externalSource : "Bruger";
  return {
    id: p.id,
    title: p.name,
    subtitle: `${source} · oprettet ${p.createdAt.toLocaleDateString("da-DK")}`,
    productId: p.id,
    values: productFieldValues(p),
  };
}

function differs(columns: CompareColumn[]) {
  return DUPLICATE_FIELDS.some((field) => {
    if (field.readOnly) return false;
    const filled = columns.map((c) => c.values[field.key]).filter((v) => !isEmptyValue(v));
    return filled.some((v) => !sameValue(v, filled[0])) || (filled.length > 0 && filled.length < columns.length);
  });
}

// ---------- (1) Bilka + REMA 1000 ----------

async function sourceConflictProductIds() {
  const rows = await prisma.$queryRaw<{ productId: string }[]>`
    SELECT "productId" FROM "product_source_records"
    WHERE "reviewedAt" IS NULL
    GROUP BY "productId" HAVING count(*) >= 2
    ORDER BY "productId"`;
  return rows.map((r) => r.productId);
}

async function loadSourceGroups(productIds: string[]): Promise<CompareGroup[]> {
  if (productIds.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { ...productCompareInclude, sourceRecords: { orderBy: { source: "asc" } } },
  });
  const groups: CompareGroup[] = [];
  for (const p of products) {
    const sourceColumns: CompareColumn[] = p.sourceRecords.map((record) => ({
      id: record.id,
      title: SOURCE_LABELS[record.source] ?? record.source,
      subtitle: "Butikkens egne data",
      productId: null,
      values: sourceRecordValues(record.data),
    }));
    const final = productColumn(p);
    final.subtitle = "Varen i databasen";
    const columns = [...sourceColumns, final];
    if (!differs(sourceColumns)) continue;
    groups.push({
      key: `sources:${p.id}`,
      kind: "sources",
      reason: "Samme stregkode hos Bilka og REMA 1000 med forskellige oplysninger",
      columns,
      finalColumnId: final.id,
      hiddenCount: 0,
    });
  }
  return groups;
}

// ---------- (2) + (3) produkter der er samme vare ----------

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

async function productDuplicateSets(): Promise<{ ids: string[]; reason: string }[]> {
  const [pending, resolved, nameGroups] = await Promise.all([
    prisma.productDuplicateLink.findMany({
      where: { status: "PENDING" },
      select: { productAId: true, productBId: true },
    }),
    prisma.productDuplicateLink.findMany({
      where: { status: { not: "PENDING" } },
      select: { productAId: true, productBId: true },
    }),
    prisma.$queryRaw<{ ids: string[] }[]>`
      SELECT array_agg(id ORDER BY "createdAt") AS ids FROM "products"
      WHERE "privateOwnerId" IS NULL AND status <> 'REJECTED'
      GROUP BY lower(btrim(name)), "brandId", lower(coalesce(btrim("packageSizeText"), ''))
      HAVING count(*) > 1
      LIMIT 500`,
  ]);
  const dismissed = new Set(resolved.map((l) => pairKey(l.productAId, l.productBId)));

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const reasonOf = new Map<string, Set<string>>();
  const addReason = (id: string, reason: string) => {
    reasonOf.set(id, (reasonOf.get(id) ?? new Set()).add(reason));
  };

  for (const l of pending) {
    union(l.productAId, l.productBId);
    addReason(l.productAId, "Oprettet samtidig med samme navn");
    addReason(l.productBId, "Oprettet samtidig med samme navn");
  }
  for (const g of nameGroups) {
    for (let i = 0; i < g.ids.length; i++) {
      for (let j = i + 1; j < g.ids.length; j++) {
        if (dismissed.has(pairKey(g.ids[i], g.ids[j]))) continue;
        union(g.ids[i], g.ids[j]);
        addReason(g.ids[i], "Samme navn, brand og mængde");
        addReason(g.ids[j], "Samme navn, brand og mængde");
      }
    }
  }

  const sets = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    sets.set(root, [...(sets.get(root) ?? []), id]);
  }
  return [...sets.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({
      ids: ids.sort(),
      reason: [...new Set(ids.flatMap((id) => [...(reasonOf.get(id) ?? [])]))].join(" · "),
    }))
    .sort((a, b) => a.ids[0].localeCompare(b.ids[0]));
}

async function loadProductGroups(sets: { ids: string[]; reason: string }[]): Promise<CompareGroup[]> {
  if (sets.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: sets.flatMap((s) => s.ids.slice(0, MAX_COLUMNS)) } },
    include: productCompareInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups: CompareGroup[] = [];
  for (const set of sets) {
    const members = set.ids
      .map((id) => byId.get(id))
      .filter((p): p is CompareProduct => !!p)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, MAX_COLUMNS);
    if (members.length < 2) continue;
    // Udgangspunkt for "Endelig": den ældste godkendte, ellers den ældste.
    const final = members.find((p) => p.status === "APPROVED") ?? members[0];
    groups.push({
      key: `products:${members.map((p) => p.id).join(",")}`,
      kind: "products",
      reason: set.reason,
      columns: members.map(productColumn),
      finalColumnId: final.id,
      hiddenCount: Math.max(0, set.ids.length - MAX_COLUMNS),
    });
  }
  return groups;
}

export async function loadDuplicateProductPage(page: number) {
  const [sourceIds, sets] = await Promise.all([sourceConflictProductIds(), productDuplicateSets()]);
  // Én samlet liste: butiks-konflikter først, derefter produkt-grupper.
  const entries = [
    ...sourceIds.map((id) => ({ type: "sources" as const, id })),
    ...sets.map((set) => ({ type: "products" as const, set })),
  ];
  const slice = entries.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);
  const [sourceGroups, productGroups] = await Promise.all([
    loadSourceGroups(slice.flatMap((e) => (e.type === "sources" ? [e.id] : []))),
    loadProductGroups(slice.flatMap((e) => (e.type === "products" ? [e.set] : []))),
  ]);
  return { total: entries.length, groups: [...sourceGroups, ...productGroups] };
}

// ---------- Produktbilleder ----------

export type ImageCandidate = { id: string; url: string; tags: string[]; isPrimary: boolean };
export type ImageGroup = {
  productId: string;
  name: string;
  brand: string | null;
  barcodes: string[];
  images: ImageCandidate[];
};

export async function loadDuplicateImagePage(page: number) {
  const tags = REVIEW_IMAGE_TAGS;
  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM (
        SELECT pi."productId" FROM "product_images" pi JOIN "products" p ON p.id = pi."productId"
        WHERE p."imagesReviewedAt" IS NULL AND pi.tags && ${tags}::text[]
        GROUP BY pi."productId" HAVING count(DISTINCT pi.url) >= 2
      ) t`,
    prisma.$queryRaw<{ productId: string }[]>`
      SELECT pi."productId" FROM "product_images" pi JOIN "products" p ON p.id = pi."productId"
      WHERE p."imagesReviewedAt" IS NULL AND pi.tags && ${tags}::text[]
      GROUP BY pi."productId" HAVING count(DISTINCT pi.url) >= 2
      ORDER BY pi."productId"
      LIMIT ${GROUPS_PER_PAGE} OFFSET ${(page - 1) * GROUPS_PER_PAGE}`,
  ]);
  const products = await prisma.product.findMany({
    where: { id: { in: idRows.map((r) => r.productId) } },
    include: { brand: true, barcodes: true, images: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
  const groups: ImageGroup[] = products.map((p) => {
    const images: ImageCandidate[] = p.images.map((img) => ({
      id: img.id,
      url: img.url,
      tags: img.tags,
      isPrimary: img.url === p.imageUrl,
    }));
    if (p.imageUrl && !images.some((img) => img.url === p.imageUrl)) {
      images.unshift({ id: "primary", url: p.imageUrl, tags: [], isPrimary: true });
    }
    return {
      productId: p.id,
      name: p.name,
      brand: p.brand?.name ?? null,
      barcodes: p.barcodes.map((b) => b.code),
      images,
    };
  });
  return { total: Number(countRows[0]?.n ?? 0), groups };
}

export async function countDuplicateReviews() {
  const [images, products] = await Promise.all([
    loadDuplicateImagePage(1).then((r) => r.total),
    Promise.all([sourceConflictProductIds(), productDuplicateSets()]).then(([a, b]) => a.length + b.length),
  ]);
  return { images, products };
}

// ---------- Gem ----------

type Tx = Prisma.TransactionClient;

const PRODUCT_CATEGORIES = new Set<string>(["DRINK", "VEGETABLES", "GENERIC", "PROCESSED", "RAW", "INGREDIENT"]);

function asText(v: DuplicateFieldValue) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function asNumber(v: DuplicateFieldValue) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asList(v: DuplicateFieldValue) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
}

// Skriver admin's valgte værdier på det endelige produkt. Kun nøgler i
// DUPLICATE_FIELDS (ikke read-only) bruges; påkrævede felter kan ikke tømmes.
export async function applyFieldValues(tx: Tx, productId: string, values: DuplicateFieldValues) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(values, key);
  const product: Prisma.ProductUpdateInput = {};

  if (has("name") && asText(values.name)) product.name = asText(values.name)!;
  if (has("brand")) {
    const brand = asText(values.brand);
    product.brand = brand
      ? { connectOrCreate: { where: { name: brand }, create: { name: brand } } }
      : { disconnect: true };
  }
  for (const key of ["subbrand", "productType", "variant", "flavor", "packageSizeText", "ingredientsText"] as const) {
    if (has(key)) product[key] = asText(values[key]);
  }
  if (has("packCount")) {
    const n = asNumber(values.packCount);
    product.packCount = n === null ? null : Math.round(n);
  }
  if (has("productCategory")) {
    const c = asText(values.productCategory);
    product.productCategory = c && PRODUCT_CATEGORIES.has(c) ? (c as ProductCategory) : null;
  }
  for (const key of ["keywords", "allergens", "additives"] as const) {
    if (has(key)) product[key] = asList(values[key]);
  }
  if (has("imageUrl") && asText(values.imageUrl)) product.imageUrl = asText(values.imageUrl);
  const macros = { kcal: "kcalPer100g", protein: "proteinPer100g", carbs: "carbsPer100g", fat: "fatPer100g" } as const;
  for (const [key, column] of Object.entries(macros)) {
    const n = has(key) ? asNumber(values[key]) : null;
    if (n !== null) product[column] = n;
  }
  if (has("saturatedFat")) product.saturatedFatPer100g = asNumber(values.saturatedFat);
  await tx.product.update({ where: { id: productId }, data: product });

  const nutrition: Record<string, number | null> = {};
  const nutritionColumns = {
    energyKj: "energyKjPer100g",
    sugars: "sugarsPer100g",
    fiber: "fiberPer100g",
    salt: "saltPer100g",
  } as const;
  for (const [key, column] of Object.entries(nutritionColumns)) {
    if (has(key)) nutrition[column] = asNumber(values[key]);
  }
  if (Object.keys(nutrition).length) {
    await tx.productNutritionFeatures.upsert({
      where: { productId },
      update: nutrition,
      create: { productId, ...nutrition },
    });
  }

  const filters: Record<string, string | number | string[] | null> = {};
  for (const key of FILTER_TEXT_KEYS) if (has(key)) filters[key] = asText(values[key]);
  for (const key of FILTER_NUMBER_KEYS) if (has(key)) filters[key] = asNumber(values[key]);
  for (const key of FILTER_LIST_KEYS) if (has(key)) filters[key] = asList(values[key]);
  if (Object.keys(filters).length) {
    await tx.productFilters.upsert({
      where: { productId },
      update: filters,
      create: { productId, ...filters },
    });
  }
}

// Flytter alt fra discardId over på keepId og sletter discardId. Samme regler
// som den tidligere par-fletning: registreringer beholder deres snapshot.
export async function mergeProductInto(tx: Tx, keepId: string, discardId: string) {
  await tx.barcode.updateMany({ where: { productId: discardId }, data: { productId: keepId } });
  await tx.registration.updateMany({ where: { productId: discardId }, data: { productId: keepId } });
  await tx.dishIngredient.updateMany({ where: { productId: discardId }, data: { productId: keepId } });
  await tx.pointsTransaction.updateMany({ where: { productId: discardId }, data: { productId: keepId } });
  await tx.forward.updateMany({ where: { productId: discardId }, data: { productId: keepId } });

  const keepIngredientIds = new Set(
    (await tx.productIngredient.findMany({ where: { productId: keepId }, select: { ingredientId: true } })).map(
      (row) => row.ingredientId,
    ),
  );
  for (const row of await tx.productIngredient.findMany({ where: { productId: discardId } })) {
    if (keepIngredientIds.has(row.ingredientId)) await tx.productIngredient.delete({ where: { id: row.id } });
    else await tx.productIngredient.update({ where: { id: row.id }, data: { productId: keepId } });
  }

  for (const fav of await tx.favorite.findMany({ where: { productId: discardId } })) {
    const clash = await tx.favorite.findFirst({ where: { userId: fav.userId, productId: keepId, dishId: fav.dishId } });
    if (clash) await tx.favorite.delete({ where: { id: fav.id } });
    else await tx.favorite.update({ where: { id: fav.id }, data: { productId: keepId } });
  }

  const keepStores = new Set(
    (await tx.productStore.findMany({ where: { productId: keepId }, select: { storeId: true } })).map((s) => s.storeId),
  );
  for (const s of await tx.productStore.findMany({ where: { productId: discardId } })) {
    if (!keepStores.has(s.storeId)) await tx.productStore.create({ data: { productId: keepId, storeId: s.storeId } });
  }

  const keepSources = new Set(
    (await tx.productSourceRecord.findMany({ where: { productId: keepId }, select: { source: true } })).map((s) => s.source),
  );
  for (const r of await tx.productSourceRecord.findMany({ where: { productId: discardId } })) {
    if (!keepSources.has(r.source)) await tx.productSourceRecord.update({ where: { id: r.id }, data: { productId: keepId } });
  }

  // Billederne følger med og vises bagefter under Produktbilleder, så admin
  // kan vælge mellem dem.
  const discard = await tx.product.findUnique({ where: { id: discardId }, select: { imageUrl: true } });
  const keepUrls = new Set(
    (await tx.productImage.findMany({ where: { productId: keepId }, select: { url: true } })).map((i) => i.url),
  );
  const keep = await tx.product.findUnique({ where: { id: keepId }, select: { imageUrl: true } });
  if (keep?.imageUrl) keepUrls.add(keep.imageUrl);
  const moved = await tx.productImage.findMany({ where: { productId: discardId }, orderBy: { order: "asc" } });
  const urls = [...(discard?.imageUrl ? [{ url: discard.imageUrl, tags: [] as string[] }] : []), ...moved];
  let order = keepUrls.size;
  let added = 0;
  for (const img of urls) {
    if (keepUrls.has(img.url)) continue;
    keepUrls.add(img.url);
    await tx.productImage.create({
      data: { productId: keepId, url: img.url, tags: [...new Set([...img.tags, "Flettet"])], order: order++ },
    });
    added++;
  }
  if (added > 0) {
    // Kepts eget hovedbillede skal også kunne vælges på fanen.
    if (keep?.imageUrl && !(await tx.productImage.findFirst({ where: { productId: keepId, url: keep.imageUrl } }))) {
      await tx.productImage.create({ data: { productId: keepId, url: keep.imageUrl, tags: ["Flettet"], order: 0 } });
    }
    await tx.product.update({ where: { id: keepId }, data: { imagesReviewedAt: null } });
  }

  await tx.productDuplicateLink.updateMany({
    where: {
      status: "PENDING",
      OR: [
        { productAId: discardId, productBId: keepId },
        { productAId: keepId, productBId: discardId },
      ],
    },
    data: { status: "MERGED", resolvedAt: new Date() },
  });
  await tx.product.delete({ where: { id: discardId } });
}

// "Ikke dubletter": gemmes som DISMISSED-par, så gruppen ikke dukker op igen
// via samme navn/brand/mængde.
export async function dismissProductSet(productIds: string[]) {
  const now = new Date();
  for (let i = 0; i < productIds.length; i++) {
    for (let j = i + 1; j < productIds.length; j++) {
      const [productAId, productBId] = [productIds[i], productIds[j]].sort();
      await prisma.productDuplicateLink.upsert({
        where: { productAId_productBId: { productAId, productBId } },
        update: { status: "DISMISSED", resolvedAt: now },
        create: { productAId, productBId, status: "DISMISSED", resolvedAt: now },
      });
    }
  }
}
