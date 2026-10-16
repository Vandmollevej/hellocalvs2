import { GenericIngredientCategory, GenericIngredientCookingState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admin → Varer → Generiske produkter (docs/DECISIONS.md 2026-10-15):
// opret, importér (CSV/.xlsx i samme format som "Generiske produkter.xlsx"),
// redigér og slet generiske produkter. Næringstal kopieres KUN fra den valgte
// Frida-vare (snapshot-princip, se GenericIngredient i prisma/schema.prisma);
// en anden kilde giver tomme tal ("–"), aldrig et skøn.

export type GenericSource =
  | { kind: "FRIDA"; foodId: string }
  | { kind: "OTHER"; name: string; url: string };

export type GenericProductInput = {
  sheetCategory: string;
  productType: string;
  variation: string;
  keywords: string[];
  properties: string[];
  nameSingular: string;
  namePlural: string;
  source: GenericSource;
};

// Arkets kolonner (første række). "Frida-navn" er kun til reference og læses
// ikke — navnet slås op ud fra FoodID. Kilde/Kilde-URL bruges til rækker uden
// Frida FoodID.
export const SHEET_COLUMNS = {
  sheetCategory: "Kategori",
  productType: "Produkttype",
  variation: "Variation",
  keywords: "Nøgleord",
  properties: "Egenskaber",
  nameSingular: "Titel (ental)",
  namePlural: "Titel (flertal)",
  fridaFoodId: "Frida FoodID",
  sourceName: "Kilde",
  sourceUrl: "Kilde-URL",
} as const;

type ColumnKey = keyof typeof SHEET_COLUMNS;

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const splitList = (value: string) =>
  value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

export const nameKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const COOKED_PROPERTIES = new Set([
  "kogt",
  "stegt",
  "friturestegt",
  "bagt",
  "færdigbagt",
  "ovnbagt",
  "grillet",
  "ristet",
  "dampet",
  "tilberedt",
]);

// Rå/tilberedt (docs/REGLER.md 2026-10-08) udledes af Egenskaber.
export function cookingStateFor(properties: string[]): GenericIngredientCookingState {
  return properties.some((p) => COOKED_PROPERTIES.has(p.toLowerCase()))
    ? GenericIngredientCookingState.COOKED
    : GenericIngredientCookingState.RAW;
}

// Den grove app-kategori (frugt/grønt/kød/andet) udledes af arkets Kategori.
export function appCategoryFor(sheetCategory: string): GenericIngredientCategory {
  const text = sheetCategory.toLowerCase();
  if (/juice|saft|smoothie|drik|konserves|marmelade|syltet/.test(text)) return GenericIngredientCategory.OTHER;
  if (/frugt|bær/.test(text)) return GenericIngredientCategory.FRUIT;
  if (/grøntsag|bælgplant|kartof|svampe|krydderurt/.test(text)) return GenericIngredientCategory.VEGETABLE;
  if (/kød|kylling|høns|kalkun|and og gås|vildt|indmad/.test(text)) return GenericIngredientCategory.MEAT;
  return GenericIngredientCategory.OTHER;
}

export function validateInput(input: GenericProductInput): string[] {
  const errors: string[] = [];
  if (!input.sheetCategory) errors.push("Kategori mangler");
  if (!input.productType) errors.push("Produkttype mangler");
  if (!input.nameSingular) errors.push("Titel (ental) mangler");
  if (!input.namePlural) errors.push("Titel (flertal) mangler");
  if (input.source.kind === "FRIDA") {
    if (!/^\d+(-\d+)?$/.test(input.source.foodId)) errors.push("Kilde mangler: angiv Frida FoodID eller en anden kilde");
  } else {
    if (!input.source.name) errors.push("Kilde mangler: angiv Frida FoodID eller en anden kilde");
    if (!/^https?:\/\/\S+$/i.test(input.source.url)) errors.push("Kilde-URL mangler eller er ugyldig (skal starte med https://)");
  }
  for (const [label, value] of [
    ["Kategori", input.sheetCategory],
    ["Produkttype", input.productType],
    ["Variation", input.variation],
    ["Titel (ental)", input.nameSingular],
    ["Titel (flertal)", input.namePlural],
  ] as const) {
    if (value.length > 160) errors.push(`${label} er for lang`);
  }
  return errors;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : splitList(str(value));

// Fra formularens JSON.
export function inputFromJson(body: Record<string, unknown> | null): GenericProductInput {
  const source = (body?.source ?? {}) as Record<string, unknown>;
  return {
    sheetCategory: str(body?.sheetCategory),
    productType: str(body?.productType),
    variation: str(body?.variation),
    keywords: list(body?.keywords),
    properties: list(body?.properties),
    nameSingular: str(body?.nameSingular),
    namePlural: str(body?.namePlural),
    source:
      source.kind === "OTHER"
        ? { kind: "OTHER", name: str(source.name), url: str(source.url) }
        : { kind: "FRIDA", foodId: str(source.foodId) },
  };
}

export type ImportRow = {
  line: number;
  input: GenericProductInput;
  fridaName: string | null;
  kcalPer100g: number | null;
  errors: string[];
};

export type ImportPreview = {
  missingColumns: string[];
  rows: ImportRow[];
};

// Arkets rækker → forhåndsvisning med fejl pr. række (manglende påkrævede
// felter, ukendt Frida FoodID, dubletter i filen og mod eksisterende).
export async function previewImport(table: string[][]): Promise<ImportPreview> {
  const header = (table[0] ?? []).map(normalizeHeader);
  const index = {} as Record<ColumnKey, number>;
  for (const [key, label] of Object.entries(SHEET_COLUMNS) as [ColumnKey, string][]) {
    index[key] = header.indexOf(normalizeHeader(label));
  }
  const required: ColumnKey[] = ["sheetCategory", "productType", "nameSingular", "namePlural"];
  const missingColumns: string[] = required.filter((key) => index[key] < 0).map((key) => SHEET_COLUMNS[key]);
  if (index.fridaFoodId < 0 && index.sourceName < 0) missingColumns.push(`${SHEET_COLUMNS.fridaFoodId} eller ${SHEET_COLUMNS.sourceName}`);
  if (missingColumns.length > 0) return { missingColumns, rows: [] };

  const cell = (row: string[], key: ColumnKey) => (index[key] >= 0 ? (row[index[key]] ?? "").trim() : "");
  const parsed: ImportRow[] = [];
  table.slice(1).forEach((row, i) => {
    if (row.every((value) => !value?.trim())) return;
    const foodId = cell(row, "fridaFoodId").replace(/\.0+$/, "");
    const input: GenericProductInput = {
      sheetCategory: cell(row, "sheetCategory"),
      productType: cell(row, "productType"),
      variation: cell(row, "variation"),
      keywords: splitList(cell(row, "keywords")),
      properties: splitList(cell(row, "properties")),
      nameSingular: cell(row, "nameSingular"),
      namePlural: cell(row, "namePlural"),
      source: foodId
        ? { kind: "FRIDA", foodId }
        : { kind: "OTHER", name: cell(row, "sourceName"), url: cell(row, "sourceUrl") },
    };
    parsed.push({ line: i + 2, input, fridaName: null, kcalPer100g: null, errors: validateInput(input) });
  });

  const fridaIds = [...new Set(parsed.flatMap((r) => (r.input.source.kind === "FRIDA" ? [r.input.source.foodId] : [])))];
  const frida = await findFridaByFoodIds(fridaIds);
  const existing = new Set(
    (
      await prisma.genericIngredient.findMany({ where: { archivedAt: null }, select: { name: true, nameSingular: true } })
    ).map((row) => nameKey(row.nameSingular ?? row.name))
  );
  const seen = new Map<string, number>();
  for (const row of parsed) {
    if (row.input.source.kind === "FRIDA" && row.input.source.foodId) {
      const product = frida.get(row.input.source.foodId);
      if (product) {
        row.fridaName = product.name;
        row.kcalPer100g = product.kcalPer100g;
      } else if (row.errors.length === 0 || /^\d/.test(row.input.source.foodId)) {
        row.errors.push(`Frida FoodID ${row.input.source.foodId} findes ikke`);
      }
    }
    const key = nameKey(row.input.nameSingular);
    if (!key) continue;
    if (existing.has(key)) row.errors.push("Dublet: findes allerede");
    const earlier = seen.get(key);
    if (earlier) row.errors.push(`Dublet: samme titel som række ${earlier}`);
    else seen.set(key, row.line);
  }
  return { missingColumns: [], rows: parsed };
}

const FRIDA_SELECT = {
  id: true,
  externalId: true,
  name: true,
  kcalPer100g: true,
  proteinPer100g: true,
  carbsPer100g: true,
  fatPer100g: true,
  micronutrientsPer100g: true,
} satisfies Prisma.ProductSelect;

type FridaRow = Prisma.ProductGetPayload<{ select: typeof FRIDA_SELECT }>;

export async function findFridaByFoodIds(foodIds: string[]): Promise<Map<string, FridaRow>> {
  if (foodIds.length === 0) return new Map();
  const rows = await prisma.product.findMany({
    where: { externalSource: "FRIDA", externalId: { in: foodIds } },
    select: FRIDA_SELECT,
  });
  return new Map(rows.map((row) => [row.externalId ?? "", row]));
}

export async function searchFrida(query: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.product.findMany({
    where: {
      externalSource: "FRIDA",
      OR: [{ externalId: q }, { name: { contains: q, mode: "insensitive" } }],
    },
    select: { externalId: true, name: true, kcalPer100g: true },
    orderBy: { name: "asc" },
    take: 15,
  });
}

// Data der skrives på rækken. Næring kun fra Frida; anden kilde = tomt.
function rowData(input: GenericProductInput, frida: FridaRow | null, keepSnapshot = false) {
  const nutrition = keepSnapshot
    ? {}
    : frida
    ? {
        fridaProductId: frida.id,
        kcalPer100g: frida.kcalPer100g,
        proteinPer100g: frida.proteinPer100g,
        carbsPer100g: frida.carbsPer100g,
        fatPer100g: frida.fatPer100g,
        micronutrientsPer100g: frida.micronutrientsPer100g ?? Prisma.DbNull,
      }
    : {
        fridaProductId: null,
        kcalPer100g: null,
        proteinPer100g: null,
        carbsPer100g: null,
        fatPer100g: null,
        micronutrientsPer100g: Prisma.DbNull,
      };
  return {
    name: input.nameSingular,
    nameSingular: input.nameSingular,
    namePlural: input.namePlural,
    sheetCategory: input.sheetCategory,
    productType: input.productType,
    variation: input.variation || null,
    keywords: input.keywords,
    properties: input.properties,
    category: appCategoryFor(input.sheetCategory),
    cookingState: cookingStateFor(input.properties),
    sourceKind: input.source.kind,
    sourceName: input.source.kind === "OTHER" ? input.source.name : null,
    sourceUrl: input.source.kind === "OTHER" ? input.source.url : null,
    ...nutrition,
  };
}

export class GenericProductError extends Error {}

async function resolveFrida(input: GenericProductInput): Promise<FridaRow | null> {
  if (input.source.kind !== "FRIDA") return null;
  const frida = (await findFridaByFoodIds([input.source.foodId])).get(input.source.foodId);
  if (!frida) throw new GenericProductError(`Frida FoodID ${input.source.foodId} findes ikke`);
  return frida;
}

async function assertNotDuplicate(input: GenericProductInput, exceptId?: string) {
  const clash = await prisma.genericIngredient.findFirst({
    where: {
      archivedAt: null,
      id: exceptId ? { not: exceptId } : undefined,
      OR: [
        { nameSingular: { equals: input.nameSingular, mode: "insensitive" } },
        { name: { equals: input.nameSingular, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (clash) throw new GenericProductError("Dublet: et generisk produkt med samme titel (ental) findes allerede");
}

export async function createGenericProduct(input: GenericProductInput, userId: string) {
  const errors = validateInput(input);
  if (errors.length) throw new GenericProductError(errors.join(". "));
  await assertNotDuplicate(input);
  const frida = await resolveFrida(input);
  return prisma.genericIngredient.create({ data: { ...rowData(input, frida), createdByUserId: userId } });
}

// Ændres kilden ikke (samme Frida-vare), bevares de kopierede næringstal;
// ellers kopieres de igen fra den nye kilde. Gamle registreringer har deres
// egne snapshots og berøres aldrig.
export async function updateGenericProduct(id: string, input: GenericProductInput) {
  const errors = validateInput(input);
  if (errors.length) throw new GenericProductError(errors.join(". "));
  const current = await prisma.genericIngredient.findUnique({ where: { id }, select: { fridaProductId: true } });
  if (!current) throw new GenericProductError("Det generiske produkt findes ikke længere");
  await assertNotDuplicate(input, id);
  const frida = await resolveFrida(input);
  const keepSnapshot = frida !== null && frida.id === current.fridaProductId;
  return prisma.genericIngredient.update({ where: { id }, data: rowData(input, frida, keepSnapshot) });
}

export async function importGenericProducts(table: string[][], userId: string) {
  const preview = await previewImport(table);
  if (preview.missingColumns.length) throw new GenericProductError(`Mangler kolonner: ${preview.missingColumns.join(", ")}`);
  const valid = preview.rows.filter((row) => row.errors.length === 0);
  const frida = await findFridaByFoodIds(
    valid.flatMap((row) => (row.input.source.kind === "FRIDA" ? [row.input.source.foodId] : []))
  );
  const data = valid.map((row) => ({
    ...rowData(row.input, row.input.source.kind === "FRIDA" ? (frida.get(row.input.source.foodId) ?? null) : null),
    createdByUserId: userId,
  }));
  let created = 0;
  for (let i = 0; i < data.length; i += 200) {
    created += (await prisma.genericIngredient.createMany({ data: data.slice(i, i + 200) })).count;
  }
  return { created, skipped: preview.rows.length - valid.length };
}

// Sletning: bruges produktet i registreringer, arkiveres det (skjules fra
// søgning) i stedet, så registreringerne (snapshots) kan åbnes som før.
export async function deleteGenericProduct(id: string): Promise<"deleted" | "archived"> {
  const registrations = await prisma.registration.count({ where: { genericIngredientId: id } });
  if (registrations > 0) {
    await prisma.genericIngredient.update({ where: { id }, data: { archivedAt: new Date() } });
    return "archived";
  }
  await prisma.genericIngredient.delete({ where: { id } });
  return "deleted";
}

export async function restoreGenericProduct(id: string) {
  const row = await prisma.genericIngredient.findUnique({ where: { id }, select: { name: true, nameSingular: true } });
  if (!row) throw new GenericProductError("Det generiske produkt findes ikke længere");
  const clash = await prisma.genericIngredient.findFirst({
    where: { archivedAt: null, id: { not: id }, nameSingular: { equals: row.nameSingular ?? row.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) throw new GenericProductError("Kan ikke gendannes: et aktivt produkt har samme titel");
  await prisma.genericIngredient.update({ where: { id }, data: { archivedAt: null } });
}

// --- Listen i admin (søgning, filter, gradvis indlæsning) ---

export const LIST_PAGE_SIZE = 100;

export type GenericListFilters = { q: string; category: string; source: string; status: string };

export type GenericProductRow = {
  id: string;
  sheetCategory: string;
  productType: string;
  variation: string;
  keywords: string[];
  properties: string[];
  nameSingular: string;
  namePlural: string;
  sourceKind: "FRIDA" | "OTHER" | null;
  sourceName: string;
  sourceUrl: string;
  fridaFoodId: string;
  fridaName: string;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  registrations: number;
  archived: boolean;
};

export function parseListFilters(raw: Record<string, string | undefined>): GenericListFilters {
  return {
    q: raw.q?.trim() ?? "",
    category: raw.category ?? "",
    source: ["frida", "other", "none"].includes(raw.source ?? "") ? (raw.source ?? "") : "",
    status: raw.status === "archived" ? "archived" : "",
  };
}

function listWhere(filters: GenericListFilters): Prisma.GenericIngredientWhereInput {
  return {
    archivedAt: filters.status === "archived" ? { not: null } : null,
    ...(filters.category ? { sheetCategory: filters.category } : {}),
    ...(filters.source === "frida" ? { fridaProductId: { not: null } } : {}),
    ...(filters.source === "other" ? { sourceKind: "OTHER" } : {}),
    ...(filters.source === "none" ? { fridaProductId: null, OR: [{ sourceKind: null }, { sourceKind: { not: "OTHER" } }] } : {}),
    ...(filters.q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: filters.q, mode: "insensitive" } },
                { nameSingular: { contains: filters.q, mode: "insensitive" } },
                { namePlural: { contains: filters.q, mode: "insensitive" } },
                { productType: { contains: filters.q, mode: "insensitive" } },
                { variation: { contains: filters.q, mode: "insensitive" } },
                { keywords: { has: filters.q.toLowerCase() } },
              ],
            },
          ],
        }
      : {}),
  };
}

export async function listGenericProducts(filters: GenericListFilters, page: number) {
  const where = listWhere(filters);
  const [matching, rows] = await Promise.all([
    prisma.genericIngredient.count({ where }),
    prisma.genericIngredient.findMany({
      where,
      orderBy: [{ sheetCategory: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (Math.max(1, page) - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
      include: {
        fridaProduct: { select: { externalId: true, name: true } },
        _count: { select: { registrations: true } },
      },
    }),
  ]);
  const list: GenericProductRow[] = rows.map((row) => ({
    id: row.id,
    sheetCategory: row.sheetCategory ?? "",
    productType: row.productType ?? "",
    variation: row.variation ?? "",
    keywords: row.keywords,
    properties: row.properties,
    nameSingular: row.nameSingular ?? row.name,
    namePlural: row.namePlural ?? row.name,
    sourceKind: row.sourceKind === "OTHER" ? "OTHER" : row.fridaProduct ? "FRIDA" : null,
    sourceName: row.sourceName ?? "",
    sourceUrl: row.sourceUrl ?? "",
    fridaFoodId: row.fridaProduct?.externalId ?? "",
    fridaName: row.fridaProduct?.name ?? "",
    kcalPer100g: row.kcalPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatPer100g: row.fatPer100g,
    registrations: row._count.registrations,
    archived: row.archivedAt !== null,
  }));
  return { rows: list, matching, pages: Math.max(1, Math.ceil(matching / LIST_PAGE_SIZE)) };
}
