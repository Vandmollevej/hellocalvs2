// Måler opdelerens (src/lib/off-name-split.ts) nøjagtighed mod brugerens rettede ark.
//
//   py -3 scripts/off-import/build_vocab.py --holdout 5 --out <tmp>/vocab_train.json --gold-out <tmp>/gold_test.jsonl
//   node scripts/off-import/evaluate-split.mjs <tmp>/vocab_train.json <tmp>/gold_test.jsonl [--show N] [--no-brand]
//
// Prøvesættet er rækker, der IKKE er med i ordforrådet (hver 5. række). Input til opdeleren er arkets
// Original Title + Brand + Quantity — det samme, OFF giver (product_name, brands, quantity).
// Udskriver nøjagtighed pr. felt og pr. sikkerheds-spand, og et forslag til CALIBRATION-tabellen.
import fs from "node:fs";
import { buildVocabIndex, splitOffProduct, compactKey } from "../../src/lib/off-name-split.ts";

const args = process.argv.slice(2);
const vocabPath = args[0];
const goldPath = args[1];
const showIdx = args.indexOf("--show");
const show = showIdx >= 0 ? parseInt(args[showIdx + 1], 10) : 0;
const noBrand = args.includes("--no-brand");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
if (!vocabPath || !goldPath) {
  console.error("brug: node evaluate-split.mjs <vocab.json> <gold.jsonl> [--show N] [--no-brand] [--only bilka|rema|spar]");
  process.exit(1);
}
const vocab = buildVocabIndex(JSON.parse(fs.readFileSync(vocabPath, "utf8")));
let gold = fs.readFileSync(goldPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (only) gold = gold.filter((g) => g.id.startsWith(only + ":"));

const FUNCTION = new Set(["med", "uden", "og", "i", "af", "på", "fra", "til", "mod", "eller", "en", "et", "tilsat", "ikke"]);
const words = (s) =>
  String(s ?? "")
    .toLowerCase()
    .split(/[\s,]+/)
    .map((w) => compactKey(w))
    .filter((w) => w && !FUNCTION.has(w));

const same = (x, y) => x === y || (x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5));

// ord i facit-variationen, som overhovedet står i titlen (resten er udledt af ingredienser/tekst og kan ikke opdeles)
function reachable(goldWords, titleWords) {
  return goldWords.filter((w) => titleWords.some((t) => same(t, w)));
}

function jaccard(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  let inter = 0;
  const used = new Set();
  for (const x of a) {
    const j = b.findIndex((y, i) => !used.has(i) && same(x, y));
    if (j >= 0) {
      used.add(j);
      inter += 1;
    }
  }
  return inter / (a.length + b.length - inter);
}

function typeVerdict(pred, g) {
  const p = compactKey(pred.productType ?? "");
  const pp = compactKey(pred.productTypePlural ?? "");
  const t = compactKey(g.type);
  const tp = compactKey(g.plural ?? "");
  if (!p) return "none";
  if (p === t || (tp && p === tp) || (pp && pp === t)) return "exact";
  if ((p.length >= 4 && t.includes(p)) || (t.length >= 4 && p.includes(t))) return "compatible";
  const pl = (pred.productType ?? "").toLowerCase().split(/\s+/).pop();
  const tl = g.type.toLowerCase().split(/\s+/).pop();
  if (pl && tl && compactKey(pl) === compactKey(tl) && compactKey(pl).length >= 4) return "compatible";
  return "wrong";
}

const rows = [];
for (const g of gold) {
  const pred = splitOffProduct(
    { name: g.name, brands: noBrand ? null : g.brand || null, quantity: g.quantity || null, lang: "da" },
    vocab,
  );
  const tv = typeVerdict(pred, g);
  const brandOk = !g.brand || compactKey(pred.brand ?? "") === compactKey(g.brand) || compactKey(g.brand).startsWith(compactKey(pred.brand ?? "~"));
  const varJ = jaccard(words(pred.variant), reachable(words(g.variation), words(g.name)));
  const varOk = varJ >= 0.6;
  const all = (tv === "exact" || tv === "compatible") && brandOk && varOk;
  // "kan opdeles": facit-typen står i navnet (ellers er den udledt af ingredienser/kategori og kan ikke opdeles af tekst)
  const tw = words(g.name);
  const gw = words(g.type);
  const reach = gw.length > 0 && gw.every((w) => tw.some((t) => same(t, w) || (w.length >= 5 && t.includes(w)) || (t.length >= 5 && w.includes(t))));
  rows.push({ g, pred, tv, brandOk, varOk, varJ, all, reach });
}

const reachRows = rows.filter((r) => r.reach);
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + " %" : "-");
const n = rows.length;
console.log(`rækker: ${n}`);
console.log(`type præcis: ${pct(rows.filter((r) => r.tv === "exact").length, n)}  forenelig: ${pct(rows.filter((r) => r.tv === "exact" || r.tv === "compatible").length, n)}  ingen: ${pct(rows.filter((r) => r.tv === "none").length, n)}`);
console.log(`brand: ${pct(rows.filter((r) => r.brandOk).length, n)}   variation (J>=0.6): ${pct(rows.filter((r) => r.varOk).length, n)}   alt rigtigt: ${pct(rows.filter((r) => r.all).length, n)}`);
for (const s of ["bilka", "rema", "spar"]) {
  const part = rows.filter((r) => r.g.id.startsWith(s + ":"));
  if (!part.length) continue;
  console.log(`  ${s}: ${part.length} rk  type forenelig ${pct(part.filter((r) => r.tv === "exact" || r.tv === "compatible").length, part.length)}  alt ${pct(part.filter((r) => r.all).length, part.length)}`);
}

console.log(
  `
Navnet indeholder facit-typen (opdelelige): ${reachRows.length} rk (${pct(reachRows.length, n)})  type forenelig ${pct(reachRows.filter((r) => r.tv === "exact" || r.tv === "compatible").length, reachRows.length)}  type præcis ${pct(reachRows.filter((r) => r.tv === "exact").length, reachRows.length)}  alt ${pct(reachRows.filter((r) => r.all).length, reachRows.length)}`,
);
// sikkerheds-spande
console.log("\nsikkerhed (rå score) → andel hvor alt er rigtigt");
const buckets = new Map();
for (const r of rows) {
  const b = Math.min(19, Math.floor(r.pred.rawScore / 5));
  const cur = buckets.get(b) ?? { n: 0, ok: 0, typeOk: 0 };
  cur.n += 1;
  if (r.all) cur.ok += 1;
  if (r.tv === "exact" || r.tv === "compatible") cur.typeOk += 1;
  buckets.set(b, cur);
}
for (const b of [...buckets.keys()].sort((a, c) => a - c)) {
  const v = buckets.get(b);
  console.log(`  ${String(b * 5).padStart(3)}–${String(b * 5 + 4).padEnd(3)}  n=${String(v.n).padStart(5)}  alt ${pct(v.ok, v.n).padStart(8)}  type ${pct(v.typeOk, v.n).padStart(8)}`);
}

// kalibrering: pool-adjacent-violators (monoton stigende) på spande à 2 point
const step = 2;
const cal = [];
for (let s = 0; s < 100; s += step) {
  const part = reachRows.filter((r) => r.pred.rawScore >= s && r.pred.rawScore < s + step + (s + step >= 100 ? 1 : 0));
  cal.push({ x: s + step / 2, n: part.length, ok: part.filter((r) => r.all).length });
}
const blocks = [];
for (const c of cal) {
  if (c.n === 0) continue;
  blocks.push({ xs: [c.x], n: c.n, ok: c.ok });
  while (blocks.length > 1) {
    const a = blocks[blocks.length - 2];
    const b = blocks[blocks.length - 1];
    if (a.ok / a.n <= b.ok / b.n) break;
    a.xs.push(...b.xs);
    a.n += b.n;
    a.ok += b.ok;
    blocks.pop();
  }
}
const points = [[0, Math.round((100 * blocks[0].ok) / blocks[0].n)]];
for (const b of blocks) {
  const x = Math.round(b.xs.reduce((s, v) => s + v, 0) / b.xs.length);
  points.push([x, Math.round((100 * b.ok) / b.n)]);
}
points.push([100, points[points.length - 1][1]]);
console.log("\nforslag til CALIBRATION:");
console.log(JSON.stringify(points));

if (show > 0) {
  console.log("\n--- fejl ---");
  const wrong = rows.filter((r) => !r.all && (!args.includes("--reach") || r.reach));
  for (const r of wrong.slice(0, show)) {
    console.log(
      `[${r.pred.confidence}] "${r.g.name}" brand=${r.g.brand || "-"} → type "${r.pred.productType}" (facit "${r.g.type}", ${r.tv}) var "${r.pred.variant ?? ""}" (facit "${r.g.variation || ""}") ${r.pred.issues.join(",")}`,
    );
  }
}
