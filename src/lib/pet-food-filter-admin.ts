import { prisma } from "@/lib/prisma";
import {
  BASELINE,
  SETTING_MIN_WEAK,
  buildFilter,
  invalidatePetFoodFilterCache,
  isBarcodeBlocked,
  matchText,
  normaliseBarcode,
  type FilterList,
} from "@/lib/pet-food-blacklist";

// Admin → Indstillinger → Dyrefoder-filter (docs/PET-FOOD-FILTER.md): se og redigere dyrefoder-filteret.
// Standardlisterne ligger i src/data/pet-food-*.json; admin kan tilføje egne ord/mærker/stregkoder, slå
// standardudtryk fra (fx når et udtryk rammer menneskemad) og gendanne dem igen. Rettelserne gemmes i
// `pet_food_filter_edits` og virker med det samme.

export type TermState = "baseline" | "added" | "removed";
export type TermRow = { value: string; state: TermState; note: string | null };
export type BarcodeEdit = { value: string; action: "ADD" | "REMOVE"; note: string | null; createdAt: string };

export type FilterView = {
  strong: TermRow[];
  weak: TermRow[];
  brands: TermRow[];
  barcodes: { baselineCount: number; edits: BarcodeEdit[] };
  minWeakHits: { baseline: number; effective: number };
  counts: { strong: number; weak: number; brands: number; barcodes: number };
};

type Edit = { list: string; value: string; action: string; note: string | null; createdAt: Date };

const LIST_BASELINE: Record<Exclude<FilterList, "barcode">, string[]> = {
  strong: BASELINE.strong,
  weak: BASELINE.weak,
  brand: BASELINE.brands,
};

function termRows(list: Exclude<FilterList, "barcode">, edits: Edit[]): TermRow[] {
  const removed = new Map(edits.filter((e) => e.list === list && e.action === "REMOVE").map((e) => [e.value, e.note]));
  const added = edits.filter((e) => e.list === list && e.action === "ADD");
  const rows: TermRow[] = LIST_BASELINE[list].map((value) => ({
    value,
    state: removed.has(value) ? "removed" : "baseline",
    note: removed.get(value) ?? null,
  }));
  for (const edit of added) {
    if (!LIST_BASELINE[list].includes(edit.value)) rows.push({ value: edit.value, state: "added", note: edit.note });
  }
  return rows.sort((a, b) => a.value.localeCompare(b.value, "da"));
}

export async function loadFilterView(): Promise<FilterView> {
  const edits = (await prisma.petFoodFilterEdit.findMany({ orderBy: { createdAt: "desc" } })) as Edit[];
  const effective = buildFilter(edits);
  return {
    strong: termRows("strong", edits),
    weak: termRows("weak", edits),
    brands: termRows("brand", edits),
    barcodes: {
      baselineCount: BASELINE.barcodes.size,
      edits: edits
        .filter((e) => e.list === "barcode")
        .map((e) => ({
          value: e.value,
          action: e.action === "REMOVE" ? "REMOVE" : "ADD",
          note: e.note,
          createdAt: e.createdAt.toISOString(),
        })),
    },
    minWeakHits: { baseline: BASELINE.minWeakHits, effective: effective.minWeakHits },
    counts: {
      strong: effective.strong.length,
      weak: effective.weak.length,
      brands: effective.brands.length,
      barcodes:
        BASELINE.barcodes.size + effective.extraBarcodes.size - [...effective.removedBarcodes].filter((c) => BASELINE.barcodes.has(c)).length,
    },
  };
}

export type FilterOp =
  | { op: "add"; list: FilterList; value: string; note?: string }
  | { op: "remove"; list: FilterList; value: string; note?: string }
  | { op: "restore"; list: FilterList; value: string }
  | { op: "setMinWeak"; value: number }
  | { op: "test"; text?: string; barcode?: string };

export class FilterEditError extends Error {}

const MIN_LENGTH: Record<Exclude<FilterList, "barcode">, number> = { strong: 5, brand: 3, weak: 3 };

function cleanValue(list: FilterList, raw: string): string {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (list === "barcode") {
    const digits = normaliseBarcode(value);
    if (digits.length < 6 || digits.length > 14) throw new FilterEditError("En stregkode skal have 6-14 cifre.");
    return digits;
  }
  if (/[\u0000-\u001f|]/.test(value)) throw new FilterEditError("Ordet må ikke indeholde specialtegn.");
  if (value.length < MIN_LENGTH[list] || value.length > 80) {
    throw new FilterEditError(`Et ${list === "strong" ? "stærkt ord" : list === "brand" ? "mærke" : "svagt ord"} skal være ${MIN_LENGTH[list]}-80 tegn (korte ord rammer menneskemad).`);
  }
  return value;
}

function isBaseline(list: FilterList, value: string): boolean {
  return list === "barcode" ? BASELINE.barcodes.has(value) : LIST_BASELINE[list].includes(value);
}

export async function applyFilterOp(input: FilterOp, adminId: string | null) {
  if (input.op === "test") {
    const edits = await prisma.petFoodFilterEdit.findMany({ select: { list: true, value: true, action: true } });
    const filter = buildFilter(edits);
    const text = (input.text ?? "").slice(0, 2000);
    const barcode = (input.barcode ?? "").trim();
    const barcodeHit = barcode ? isBarcodeBlocked(filter, barcode) : false;
    const textHit = text ? matchText(filter, text.split("\n")) : null;
    return {
      blocked: barcodeHit || Boolean(textHit),
      barcode: barcode ? { blocked: barcodeHit, normalised: normaliseBarcode(barcode) } : null,
      text: text ? { blocked: Boolean(textHit), list: textHit?.list ?? null, match: textHit?.match ?? null } : null,
    };
  }

  if (input.op === "setMinWeak") {
    const value = Math.round(Number(input.value));
    if (!Number.isFinite(value) || value < 1 || value > 6) throw new FilterEditError("Antal svage træf skal være 1-6.");
    await prisma.petFoodFilterEdit.deleteMany({ where: { list: "setting", value: { startsWith: SETTING_MIN_WEAK } } });
    if (value !== BASELINE.minWeakHits) {
      await prisma.petFoodFilterEdit.create({
        data: { list: "setting", value: `${SETTING_MIN_WEAK}${value}`, action: "ADD", adminId },
      });
    }
    invalidatePetFoodFilterCache();
    return { ok: true };
  }

  const list = input.list;
  const value = cleanValue(list, input.value);

  if (input.op === "add") {
    if (isBaseline(list, value)) {
      // Findes allerede i standardlisten: det betyder kun at gendanne et fravalgt udtryk.
      await prisma.petFoodFilterEdit.deleteMany({ where: { list, value, action: "REMOVE" } });
    } else {
      await prisma.petFoodFilterEdit.upsert({
        where: { list_value: { list, value } },
        create: { list, value, action: "ADD", note: input.note?.slice(0, 200) ?? null, adminId },
        update: { action: "ADD", note: input.note?.slice(0, 200) ?? null, adminId },
      });
    }
  } else if (input.op === "remove") {
    const added = await prisma.petFoodFilterEdit.findUnique({ where: { list_value: { list, value } } });
    if (added && added.action === "ADD") {
      await prisma.petFoodFilterEdit.delete({ where: { id: added.id } });
    } else if (isBaseline(list, value)) {
      await prisma.petFoodFilterEdit.upsert({
        where: { list_value: { list, value } },
        create: { list, value, action: "REMOVE", note: input.note?.slice(0, 200) ?? null, adminId },
        update: { action: "REMOVE", note: input.note?.slice(0, 200) ?? null, adminId },
      });
    } else {
      throw new FilterEditError("Udtrykket findes ikke i filteret.");
    }
  } else {
    await prisma.petFoodFilterEdit.deleteMany({ where: { list, value, action: "REMOVE" } });
  }
  invalidatePetFoodFilterCache();
  return { ok: true };
}
