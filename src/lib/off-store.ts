// Server-only: Open Food Facts-vare → off_products (docs/DECISIONS.md 2026-10-11).
// Gemmer OFF's rå svar + opdelingen (src/lib/off-name-split.ts), så varen er lokal
// i vores database, også når den (endnu) ikke er oprettet som Product.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compactKey, splitOffProduct, type OffSplitResult } from "@/lib/off-name-split";
import { getOffVocab } from "@/lib/off-vocab";
import {
  buildOffRecordData,
  offSplitInputFromRaw,
  pickOffRaw,
  type OffProductFiltersData,
  type OffRaw,
} from "@/lib/off-record";
import { petFoodBlockReason } from "@/lib/pet-food-blacklist";

export type OffRecordSource = "SCAN" | "IMPORT" | "ADMIN";

function offStoreNames(raw: OffRaw): string[] {
  const tags = Array.isArray(raw.stores_tags) ? raw.stores_tags.filter((t): t is string => typeof t === "string") : [];
  const text = typeof raw.stores === "string" ? raw.stores.split(",") : [];
  return Array.from(new Set([...tags, ...text].map((t) => t.replace(/^[a-z]{2}:/, "").trim()).filter(Boolean)));
}

async function loadBrandNames() {
  const rows = await prisma.brand.findMany({ select: { name: true }, take: 50000 });
  return rows.map((row) => row.name);
}

export async function loadOffVocab() {
  return getOffVocab(loadBrandNames);
}

// JSONB kan ikke indeholde NUL-tegn; OFF-tekster kan i sjældne tilfælde gøre.
function stripNul<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).split("\\u0000").join("")) as T;
}

const json = (value: unknown) => value as Prisma.InputJsonValue;
const jsonOrNull = (value: unknown) => (value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue));

function dataFor(args: { barcode: string; raw: OffRaw; split: OffSplitResult }) {
  const d = buildOffRecordData(args);
  return {
    lang: d.lang,
    offModifiedAt: d.offModifiedAt,
    raw: json(d.raw),
    rawName: d.rawName,
    rawBrands: d.rawBrands,
    rawQuantity: d.rawQuantity,
    rawCategories: d.rawCategories,
    imageUrl: d.imageUrl,
    name: d.name,
    brand: d.brand,
    brandKnown: d.brandKnown,
    extraBrands: d.extraBrands,
    subbrand: d.subbrand,
    productType: d.productType,
    productTypePlural: d.productTypePlural,
    variant: d.variant,
    keywords: d.keywords,
    packaging: d.packaging,
    category: d.category,
    packageSizeText: d.packageSizeText,
    packCount: d.packCount,
    filters: json(d.filters),
    nutrition: jsonOrNull(d.nutrition),
    splitConfidence: d.splitConfidence,
    splitIssues: d.splitIssues,
    splitFields: json(d.splitFields),
    splitLanguage: d.splitLanguage,
    splitVersion: d.splitVersion,
    splitAt: d.splitAt,
  };
}

export type SavedOffRecord = {
  id: string;
  /** butikker OFF nævner (stores_tags + stores), til product_stores */
  storesTags: string[];
  split: OffSplitResult;
  filters: OffProductFiltersData;
  nutrition: ReturnType<typeof buildOffRecordData>["nutrition"];
};

// Gemmer (eller opdaterer) varen. `translatedName` er navnet på dansk, hvis scanningen
// har oversat det — opdelingen køres så på den danske tekst.
export async function saveOffRecord(args: {
  barcode: string;
  raw: OffRaw;
  source: OffRecordSource;
  translatedName?: string | null;
  productId?: string | null;
}): Promise<SavedOffRecord> {
  const translatedName = args.translatedName?.trim() || null;
  const raw: OffRaw = stripNul({ ...pickOffRaw(args.raw), ...(translatedName ? { _translated_name: translatedName } : {}) });
  const vocab = await loadOffVocab();
  const split = splitOffProduct(offSplitInputFromRaw(raw), vocab);
  const data = dataFor({ barcode: args.barcode, raw, split });
  const record = await prisma.offProductRecord.upsert({
    where: { barcode: args.barcode },
    create: { barcode: args.barcode, source: args.source, productId: args.productId ?? null, ...data },
    update: { ...data, fetchedAt: new Date(), ...(args.productId ? { productId: args.productId } : {}) },
    select: { id: true },
  });
  const built = buildOffRecordData({ barcode: args.barcode, raw, split });
  return { id: record.id, storesTags: offStoreNames(raw), split, filters: built.filters, nutrition: built.nutrition };
}

// Den gemte post regnet om med de nuværende regler — uden at hente eller
// gemme igen (fetchedAt røres ikke). Bruges af src/lib/external-enrichment.ts.
export async function offRecordFromStored(barcode: string): Promise<SavedOffRecord | null> {
  const row = await prisma.offProductRecord.findUnique({ where: { barcode }, select: { id: true, raw: true } });
  if (!row) return null;
  const raw = row.raw as OffRaw;
  const split = splitOffProduct(offSplitInputFromRaw(raw), await loadOffVocab());
  const built = buildOffRecordData({ barcode, raw, split });
  return { id: row.id, storesTags: offStoreNames(raw), split, filters: built.filters, nutrition: built.nutrition };
}

// Fejl ved gemning må aldrig vælte et stregkodeopslag.
export async function saveOffRecordSafely(args: Parameters<typeof saveOffRecord>[0]): Promise<SavedOffRecord | null> {
  try {
    return await saveOffRecord(args);
  } catch (error) {
    console.error("Could not save OFF record", error);
    return null;
  }
}

export async function resplitOffRecord(barcode: string) {
  const row = await prisma.offProductRecord.findUnique({ where: { barcode }, select: { id: true, raw: true } });
  if (!row) return null;
  const vocab = await loadOffVocab();
  const raw = row.raw as OffRaw;
  const split = splitOffProduct(offSplitInputFromRaw(raw), vocab);
  await prisma.offProductRecord.update({ where: { id: row.id }, data: dataFor({ barcode, raw, split }) });
  return split;
}

export async function linkOffRecordToProduct(barcode: string, productId: string) {
  await prisma.offProductRecord.updateMany({ where: { barcode }, data: { productId } });
}

// Kører opdelingen igen på de gemte rå svar (efter nye regler/ordforråd). Returnerer
// hvor mange der er behandlet og næste markør.
export async function resplitOffRecords(options: { afterId?: string | null; take?: number; onlyBelow?: number } = {}) {
  const take = Math.min(Math.max(options.take ?? 300, 1), 1000);
  const vocab = await loadOffVocab();
  const rows = await prisma.offProductRecord.findMany({
    where: {
      ...(options.afterId ? { id: { gt: options.afterId } } : {}),
      ...(options.onlyBelow !== undefined ? { splitConfidence: { lt: options.onlyBelow } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: { id: true, barcode: true, raw: true },
  });
  let processed = 0;
  for (const row of rows) {
    const raw = row.raw as OffRaw;
    const split = splitOffProduct(offSplitInputFromRaw(raw), vocab);
    const data = dataFor({ barcode: row.barcode, raw, split });
    await prisma.offProductRecord.update({ where: { id: row.id }, data });
    processed += 1;
  }
  return { processed, nextAfterId: rows.length === take ? rows[rows.length - 1].id : null };
}

// Import af OFF-udtræk (liste af OFF-vareobjekter, fx Backup/off_raa/*.json fra
// Excelark/off_hent.py). Dyrefoder gemmes aldrig.
export async function importOffProducts(products: unknown[], source: OffRecordSource = "IMPORT") {
  const vocab = await loadOffVocab();
  let saved = 0;
  let skipped = 0;
  let blocked = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const item of products) {
    if (!item || typeof item !== "object") {
      skipped += 1;
      continue;
    }
    const product = item as OffRaw;
    const code = typeof product.code === "string" ? product.code.trim() : typeof product.code === "number" ? String(product.code) : "";
    if (!/^\d{6,14}$/.test(code) || seen.has(code)) {
      skipped += 1;
      continue;
    }
    seen.add(code);
    const raw = stripNul(pickOffRaw({ ...product, code }));
    const name = String(raw.product_name_da ?? raw.product_name ?? "").trim();
    if (!name && !raw.generic_name) {
      skipped += 1;
      continue;
    }
    const block = await petFoodBlockReason({
      barcode: code,
      texts: [name, String(raw.brands ?? ""), String(raw.ingredients_text ?? "")],
    });
    if (block) {
      blocked += 1;
      continue;
    }
    try {
      const split = splitOffProduct(offSplitInputFromRaw(raw), vocab);
      const data = dataFor({ barcode: code, raw, split });
      const linked = await prisma.barcode.findUnique({ where: { code }, select: { productId: true } });
      await prisma.offProductRecord.upsert({
        where: { barcode: code },
        create: { barcode: code, source, productId: linked?.productId ?? null, ...data },
        update: { ...data, fetchedAt: new Date(), ...(linked ? { productId: linked.productId } : {}) },
      });
      saved += 1;
    } catch (error) {
      console.error("OFF import: could not save", code, error);
      failed += 1;
    }
  }
  return { saved, skipped, blocked, failed };
}

// Efter at en Product er oprettet ud fra en OFF-post: knyt posten til varen og udfyld
// tabel 3 (product_filters) og de typede næringsfelter (product_nutrition_features).
export async function applyOffRecordToProduct(productId: string, barcode: string, saved: SavedOffRecord) {
  await linkOffRecordToProduct(barcode, productId);
  const f = saved.filters;
  const filterData = {
    organic: f.organic,
    glutenFree: f.glutenFree,
    lactoseFree: f.lactoseFree,
    sugarFree: f.sugarFree,
    lowSugar: f.lowSugar,
    noAddedSugar: f.noAddedSugar,
    reducedSugar: f.reducedSugar,
    lightSugar: f.lightSugar,
    sweeteners: f.sweeteners,
    vegan: f.vegan,
    vegetarian: f.vegetarian,
    meatType: f.meatType,
    alcohol: f.alcohol,
    alcoholPercent: f.alcoholPercent,
    fatPercent: f.fatPercent,
    countryOfOrigin: f.countryOfOrigin,
    wholeGrain: f.wholeGrain,
    keyhole: f.keyhole,
    animalWelfare: f.animalWelfare,
    certifications: f.certifications,
    storage: f.storage,
    size: f.size,
    toxins: f.toxins,
  };
  await prisma.productFilters.upsert({
    where: { productId },
    create: { productId, ...filterData },
    update: filterData,
  });

  // tabel 1: product_stores — kun kæder, der allerede findes som Store (ingen nye oprettes)
  if (saved.storesTags.length > 0) {
    const stores = await prisma.store.findMany({ select: { id: true, name: true } });
    const byKey = new Map(stores.map((store) => [compactKey(store.name), store.id]));
    for (const tag of saved.storesTags) {
      const storeId = byKey.get(compactKey(tag));
      if (!storeId) continue;
      await prisma.productStore.upsert({
        where: { productId_storeId: { productId, storeId } },
        create: { productId, storeId },
        update: {},
      });
    }
  }

  const n = saved.nutrition;
  if (!n) return;
  const features = {
    energyKjPer100g: n.kj,
    monounsaturatedFatPer100g: n.monounsaturatedFat,
    polyunsaturatedFatPer100g: n.polyunsaturatedFat,
    sodiumPer100g: n.sodium,
    alcoholPer100g: n.alcohol,
    vitaminB2MgPer100g: n.micronutrients.vitaminB2 ?? null,
    vitaminB12UgPer100g: n.micronutrients.vitaminB12 ?? null,
    calciumMgPer100g: n.micronutrients.calcium ?? null,
    phosphorusMgPer100g: n.micronutrients.phosphorus ?? null,
  };
  // kun værdier OFF faktisk har — et tomt felt overskriver aldrig noget
  const present = Object.fromEntries(Object.entries(features).filter(([, v]) => v !== null && v !== undefined));
  if (Object.keys(present).length === 0) return;
  await prisma.productNutritionFeatures.upsert({
    where: { productId },
    create: { productId, ...present },
    update: present,
  });
}
