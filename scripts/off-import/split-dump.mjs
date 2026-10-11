// Kører opdeleren på rå OFF-udtræk (JSON-lister fra Excelark/off_hent.py) og viser resultatet.
//
//   node scripts/off-import/split-dump.mjs <fil.json|mappe> [--limit N] [--min 0] [--max 100] [--csv ud.csv]
//
// Bruger src/data/off-vocab.json (scripts/off-import/build_vocab.py). Ingen database.
import fs from "node:fs";
import path from "node:path";
import { buildVocabIndex, splitOffProduct } from "../../src/lib/off-name-split.ts";
import { offSplitInputFromRaw, pickOffRaw } from "../../src/lib/off-record.ts";

const args = process.argv.slice(2);
const target = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!target) {
  console.error("brug: node split-dump.mjs <fil.json|mappe> [--limit N] [--min N] [--max N] [--csv fil]");
  process.exit(1);
}
const limit = parseInt(opt("--limit", "40"), 10);
const min = parseInt(opt("--min", "0"), 10);
const max = parseInt(opt("--max", "100"), 10);
const csv = opt("--csv", "");

const vocab = buildVocabIndex(
  JSON.parse(fs.readFileSync(new URL("../../src/data/off-vocab.json", import.meta.url), "utf8")),
);
const files = fs.statSync(target).isDirectory()
  ? fs.readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => path.join(target, f))
  : [target];

const products = new Map();
for (const file of files) {
  try {
    for (const p of JSON.parse(fs.readFileSync(file, "utf8"))) if (p && p.code) products.set(p.code, p);
  } catch {
    /* ikke en vareliste */
  }
}

const rows = [];
for (const [code, p] of products) {
  const raw = pickOffRaw(p);
  const r = splitOffProduct(offSplitInputFromRaw(raw), vocab);
  rows.push({ code, raw, r });
}
const buckets = { "80-100": 0, "50-79": 0, "0-49": 0 };
for (const { r } of rows) {
  if (r.confidence >= 80) buckets["80-100"] += 1;
  else if (r.confidence >= 50) buckets["50-79"] += 1;
  else buckets["0-49"] += 1;
}
console.log(`${rows.length} varer`, buckets);
const selected = rows.filter(({ r }) => r.confidence >= min && r.confidence <= max);
for (const { code, raw, r } of selected.slice(0, limit)) {
  console.log(
    `[${String(r.confidence).padStart(3)}] ${code} "${raw.product_name_da ?? raw.product_name ?? ""}" (${raw.brands ?? "-"}, ${raw.quantity ?? "-"})\n` +
      `      → mærke=${r.brand ?? "-"} sub=${r.subbrand ?? "-"} type=${r.productType ?? "-"} var=${r.variant ?? "-"} kw=[${r.keywords.join(", ")}] mængde=${r.quantityText ?? "-"} titel="${r.title}" ${r.issues.length ? "· " + r.issues.join(",") : ""}`,
  );
}
if (csv) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = ["EAN;Sikkerhed;OFF-navn;OFF-brands;OFF-mængde;Mærke;Sub brand;Produkttype;Variation;Nøgleord;Mængde;Titel;Årsager"];
  for (const { code, raw, r } of selected) {
    lines.push(
      [code, r.confidence, raw.product_name_da ?? raw.product_name, raw.brands, raw.quantity, r.brand, r.subbrand, r.productType, r.variant, r.keywords.join(", "), r.quantityText, r.title, r.issues.join(", ")]
        .map(q)
        .join(";"),
    );
  }
  fs.writeFileSync(csv, "﻿" + lines.join("\n"), "utf8");
  console.log("CSV →", csv);
}
