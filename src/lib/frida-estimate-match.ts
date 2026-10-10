// Frida-skøn (∼) for varer uden energimærkning (brugerens krav 2026-10-10,
// docs/DECISIONS.md samme dato). Rene funktioner uden database, så de kan
// testes; robotten "frida-estimates" (src/lib/frida-estimates.ts) bruger dem.
//
// 1. Produkttypen skal ligne en Frida-produkttype mindst 90 % (ental og
//    flertal, stavemåder, bindestreger og accenter udlignes).
// 2. Har typen flere Frida-varer, vælger tilstanden (rå/fersk, kogt, tørret,
//    røget, dåse …), derefter varianten og kendetegn (fedt-%, light,
//    sukkerfri, alkoholfri). Uden tilstand foretrækkes den rå/ferske vare
//    (ellers den utilberedte).
// 3. Er flere kandidater lige gode, eller passer varens tilstand ikke på
//    nogen af dem, afgør admin det (admin → Frida-match).

export const MIN_TYPE_SIMILARITY = 0.9;

export type FridaReference = {
  id: string;
  name: string;
  namePlural: string | null;
  productType: string | null;
  variant: string | null;
  keywords: string[];
  // Frida-arkets _is_-felter (fx { isRaw: "rå", isFat: "13%", isLight: "light" }).
  tags: Record<string, string>;
};

export type ProductForFridaMatch = {
  name: string;
  productType: string | null;
  variant: string | null;
  flavor?: string | null;
  keywords?: string[];
};

export type FridaMatch =
  | { kind: "match"; reference: FridaReference; reviewKey: string }
  | { kind: "review"; candidates: FridaReference[]; reviewKey: string; typeLabel: string; reason: string }
  | { kind: "none" };

// ---------------------------------------------------------------- tekst

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "\u0001")
    .replace(/ø/g, "\u0002")
    .replace(/å/g, "\u0003")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "æ")
    .replace(/\u0002/g, "ø")
    .replace(/\u0003/g, "å")
    .replace(/[^a-z0-9æøå%,+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = curr;
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

// Danske bøjningsendelser, der stadig er samme vare ("æbler" ~ "æble",
// "rejerne" ~ "reje"). Kun til sammenligning, aldrig til visning.
const ENDINGS = ["erne", "ene", "ers", "er", "en", "et", "e", "r", "s", "n"];
function stems(word: string): string[] {
  const out = new Set([word]);
  for (const ending of ENDINGS) {
    if (word.length - ending.length >= 3 && word.endsWith(ending)) out.add(word.slice(0, -ending.length));
  }
  return [...out];
}

// To produkttyper ligner hinanden: bedste lighed mellem stammerne, uden
// mellemrum og bindestreger ("Fast-ost" = "fastost").
export function typeSimilarity(a: string, b: string): number {
  const na = normalizeText(a).replace(/[ ,]/g, "");
  const nb = normalizeText(b).replace(/[ ,]/g, "");
  if (!na || !nb) return 0;
  let best = 0;
  for (const sa of stems(na)) for (const sb of stems(nb)) best = Math.max(best, similarity(sa, sb));
  return best;
}

// ---------------------------------------------------------------- tilstand

// Tilstande, der ændrer næringen (Frida-arket: Raw / Cooked / Processed).
// Nøglen er tilstanden; ordene er bøjninger, som de står i titler.
const STATES: Record<string, string[]> = {
  raw: ["rå", "råt", "fersk", "ferske", "frisk", "friske"],
  boiled: ["kogt", "kogte", "dampet", "dampede", "blancheret", "blancherede"],
  fried: ["stegt", "stegte", "grillet", "grillede", "grillstegt", "ristet", "ristede", "bagt", "bagte", "ovnbagt", "ovnbagte", "friturestegt", "friturestegte", "paneret", "panerede"],
  dried: ["tørret", "tørrede", "soltørret", "soltørrede", "pulver", "frysetørret"],
  smoked: ["røget", "røgede", "koldrøget", "koldrøgede", "varmrøget", "varmrøgede"],
  salted: ["saltet", "saltede", "gravad", "gravet", "graved", "marineret", "marinerede", "syltet", "syltede", "sukkerlage", "lage"],
  canned: ["dåse", "konserves", "konserverede", "flåede", "flået"],
  frozen: ["frost", "frossen", "frosne", "frosset", "dybfrost", "dybfrossen", "dybfrosne", "frozen"],
  chips: ["chips"],
};
const STATE_OF_WORD = new Map<string, string>();
for (const [state, words] of Object.entries(STATES)) for (const word of words) STATE_OF_WORD.set(word, state);

// Ord, der beskriver formen, ikke selve varen ("hakket oksekød",
// "afpillede rejer"). De skilles fra produkttypen og bruges som kendetegn.
const FORM_WORDS = new Set([
  "hakket", "hakkede", "afpillede", "afpillet", "pillede", "pillet", "revet", "revne",
  "skiver", "skåret", "skårne", "strimler", "tern", "hele", "hel", "store", "stor", "små", "lille",
  "økologisk", "økologiske", "øko", "friland", "fritgående", "inspireret", "i", "på", "af", "med", "uden",
]);

function words(text: string | null | undefined): string[] {
  return normalizeText(text ?? "").split(/[ ,]+/).filter(Boolean);
}

export function statesIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const word of words(text)) {
    const state = STATE_OF_WORD.get(word);
    if (state) found.add(state);
  }
  return found;
}

function referenceStates(ref: FridaReference): Set<string> {
  const found = statesIn(`${ref.name} ${ref.variant ?? ""} ${ref.keywords.join(" ")} ${ref.tags.isCooked ?? ""}`);
  if (ref.tags.isRaw) found.add("raw");
  if (ref.tags.isFrozen) found.add("frozen");
  return found;
}

// ---------------------------------------------------------------- kendetegn

type Traits = { fatPercent: number | null; light: boolean; sugarFree: boolean; alcoholFree: boolean };

// "0,4% fedt" → 0,4; "8-12% fedt" → 10 (midten af intervallet).
function fatPercentIn(text: string): number | null {
  const match = text.toLowerCase().match(/(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|til)\s*(\d+(?:[.,]\d+)?))?\s*%/);
  if (!match) return null;
  const low = Number(match[1].replace(",", "."));
  const high = match[2] ? Number(match[2].replace(",", ".")) : low;
  const value = (low + high) / 2;
  return Number.isFinite(value) ? value : null;
}

function traitsOfText(text: string): Traits {
  const t = normalizeText(text);
  return {
    fatPercent: /fedt|mælk|fløde|ost|yoghurt|skyr|kvark|hakket|fars/.test(t) ? fatPercentIn(text) : null,
    light: /\b(light|let|lette|fedtreduceret|fedtreducerede|mager|magert|magre)\b/.test(t),
    sugarFree: /sukkerfri|uden tilsat sukker|u tilsat sukker|ikke tilsat sukker|uden sukker/.test(t),
    alcoholFree: /alkoholfri|0 0 %|0,0 %|0,0%|0 0%/.test(t),
  };
}

function referenceTraits(ref: FridaReference): Traits {
  const fromText = traitsOfText(`${ref.name} ${ref.variant ?? ""}`);
  const fat = ref.tags.isFat ? fatPercentIn(ref.tags.isFat) : null;
  return {
    fatPercent: fat ?? fromText.fatPercent,
    light: fromText.light || !!ref.tags.isLight,
    sugarFree: fromText.sugarFree || !!ref.tags.isSugarFree,
    alcoholFree: fromText.alcoholFree || !!ref.tags.isAlcoholFree,
  };
}

// ---------------------------------------------------------------- produkttype

// Varens produkttype til sammenligning: tal og alt efter dem skæres fra
// ("minimælk 0, 4% fedt" → "minimælk"), og tilstands-/formord fjernes
// ("Hakket oksekød" → "oksekød", "Flåede tomater" → "tomater").
export function coreProductType(product: ProductForFridaMatch): string {
  const source = product.productType?.trim() || product.name;
  const cut = normalizeText(source).split(/\d/)[0].split(",")[0];
  const kept = words(cut).filter((w) => !STATE_OF_WORD.has(w) && !FORM_WORDS.has(w));
  return kept.join(" ");
}

// Flertalsformen af en Frida-produkttype, læst ud af flertalstitlen på
// samme ordplads ("Ristet pølse med bacon" / "Ristede pølser med bacon" →
// "pølser").
export function pluralTypeOf(ref: FridaReference): string | null {
  if (!ref.productType || !ref.namePlural) return null;
  const singular = ref.name.split(/\s+/);
  const plural = ref.namePlural.split(/\s+/);
  const typeWords = ref.productType.split(/\s+/);
  if (singular.length !== plural.length) return null;
  const at = singular.findIndex((_, i) =>
    typeWords.every((w, k) => normalizeText(singular[i + k] ?? "") === normalizeText(w)),
  );
  if (at < 0) return null;
  const result = plural.slice(at, at + typeWords.length).join(" ");
  return normalizeText(result) === normalizeText(ref.productType) ? null : result;
}

export type FridaTypeGroup = { typeLabel: string; forms: string[]; references: FridaReference[] };

export function groupFridaReferences(references: FridaReference[]): FridaTypeGroup[] {
  const groups = new Map<string, FridaTypeGroup>();
  for (const ref of references) {
    const label = ref.productType?.trim() || ref.name.split(/[,(]/)[0].trim();
    const key = normalizeText(label);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { typeLabel: label, forms: [label], references: [] };
      groups.set(key, group);
    }
    group.references.push(ref);
    const plural = pluralTypeOf(ref);
    if (plural && !group.forms.some((f) => normalizeText(f) === normalizeText(plural))) group.forms.push(plural);
  }
  return [...groups.values()];
}

// Den Frida-produkttype, der ligner varens mest (mindst 90 %). Ved lige
// lighed vinder den længste type (mest specifik).
export function bestTypeGroup(core: string, groups: FridaTypeGroup[]): FridaTypeGroup | null {
  if (!core) return null;
  let best: { group: FridaTypeGroup; score: number } | null = null;
  for (const group of groups) {
    const score = Math.max(...group.forms.map((form) => typeSimilarity(core, form)));
    if (score < MIN_TYPE_SIMILARITY) continue;
    if (!best || score > best.score || (score === best.score && group.typeLabel.length > best.group.typeLabel.length)) {
      best = { group, score };
    }
  }
  return best?.group ?? null;
}

// ---------------------------------------------------------------- valg

function productText(product: ProductForFridaMatch): string {
  return [product.name, product.productType, product.variant, product.flavor, ...(product.keywords ?? [])]
    .filter(Boolean)
    .join(" ");
}

// Nøglen admins valg huskes under: produkttype + tilstand + kendetegn.
export function reviewKeyFor(typeLabel: string, product: ProductForFridaMatch): string {
  const text = productText(product);
  const states = [...statesIn(text)].sort();
  const traits = traitsOfText(text);
  const parts = [normalizeText(typeLabel), states.join("+") || "-"];
  if (traits.fatPercent !== null) parts.push(`fedt${traits.fatPercent}`);
  if (traits.light) parts.push("light");
  if (traits.sugarFree) parts.push("sukkerfri");
  if (traits.alcoholFree) parts.push("alkoholfri");
  return parts.join("|");
}

function variantOverlap(product: ProductForFridaMatch, ref: FridaReference, typeLabel: string): number {
  const ignore = new Set([...words(typeLabel), ...FORM_WORDS]);
  const own = new Set(words(`${product.name} ${product.variant ?? ""} ${product.flavor ?? ""}`).filter((w) => w.length >= 3 && !ignore.has(w)));
  const theirs = new Set(words(`${ref.name} ${ref.variant ?? ""}`).filter((w) => w.length >= 3 && !ignore.has(w)));
  let shared = 0;
  for (const w of own) if (theirs.has(w)) shared += 1;
  return shared;
}

// Formord, varen og Frida-varen deler ("hakket", "afpillede", "revet").
const FORMS: Record<string, string[]> = {
  minced: ["hakket", "hakkede", "fars"],
  peeled: ["afpillede", "afpillet", "pillede", "pillet"],
  grated: ["revet", "revne"],
  sliced: ["skiver", "skåret", "skårne"],
};
function formOverlap(text: string, ref: FridaReference): number {
  const own = new Set(words(text));
  const theirs = new Set(words(`${ref.name} ${ref.variant ?? ""} ${ref.keywords.join(" ")}`));
  let shared = 0;
  for (const variants of Object.values(FORMS)) {
    if (variants.some((w) => own.has(w)) && variants.some((w) => theirs.has(w))) shared += 1;
  }
  return shared;
}

function fatCompatible(own: number, theirs: number): boolean {
  return Math.abs(own - theirs) <= Math.max(1, own * 0.2);
}

function scoreCandidate(product: ProductForFridaMatch, ref: FridaReference, typeLabel: string, hint: string | null) {
  const text = productText(product);
  const wanted = statesIn(text);
  const theirs = referenceStates(ref);
  const own = traitsOfText(text);
  const ref_ = referenceTraits(ref);
  let score = 0;
  // Uforenelig: tilstanden findes ikke på Frida-varen, eller alkohol/light/
  // fedtprocent passer ikke. En uforenelig vare vælges aldrig automatisk.
  let compatible = true;
  const neutral = [...theirs].every((s) => s === "raw");

  if (wanted.size) {
    const hits = [...wanted].filter((s) => theirs.has(s)).length;
    // En Frida-vare uden tilstand ("Kyllingepølse (Pålæg)") passer til alt.
    if (hits === 0 && theirs.size > 0) compatible = false;
    score += hits * 10;
    score -= [...theirs].filter((s) => !wanted.has(s) && s !== "raw").length * 4;
  } else {
    if (theirs.has("raw")) score += 6;
    else if (theirs.size === 0) score += 3;
    else score -= theirs.size * 4;
  }

  score += variantOverlap(product, ref, typeLabel) * 3;
  score += formOverlap(text, ref) * 4;
  if (hint && words(`${ref.name} ${ref.variant ?? ""}`).some((w) => w.startsWith(hint))) score += 8;
  if (!ref.variant) score += 1;

  if (own.fatPercent !== null && ref_.fatPercent !== null) {
    if (fatCompatible(own.fatPercent, ref_.fatPercent)) score += 5 - Math.abs(own.fatPercent - ref_.fatPercent);
    else compatible = false;
  } else if (own.fatPercent === null && ref_.fatPercent !== null) score -= 0.5;
  if (own.light !== ref_.light) score -= 3;
  if (own.sugarFree && ref_.sugarFree) score += 3;
  else if (own.sugarFree !== ref_.sugarFree) score -= 1;
  if (own.alcoholFree !== ref_.alcoholFree) compatible = false;

  return {
    score,
    compatible,
    neutral,
    wantsState: wanted.size > 0,
    fatMatters: own.fatPercent !== null && ref_.fatPercent !== null,
  };
}

// Sammensatte ord: "Kyllingebryst" = Frida-typen "Kylling" + "bryst", når
// "bryst" står i en af typens Frida-varer. Kun når ingen type ligner hele ordet.
function compoundGroup(core: string, groups: FridaTypeGroup[]): { group: FridaTypeGroup; hint: string } | null {
  const word = normalizeText(core).replace(/[ ,]/g, "");
  let best: { group: FridaTypeGroup; hint: string; length: number } | null = null;
  for (const group of groups) {
    for (const form of group.forms) {
      const f = normalizeText(form).replace(/[ ,]/g, "");
      if (f.length < 3) continue;
      for (const joint of ["", "e", "s"]) {
        const prefix = f + joint;
        if (!word.startsWith(prefix) || word.length - prefix.length < 3) continue;
        const rest = word.slice(prefix.length);
        const restStems = stems(rest);
        const hit = group.references.some((r) => words(`${r.name} ${r.variant ?? ""}`).some((w) => restStems.some((st) => w.startsWith(st))));
        if (hit && (!best || f.length > best.length)) best = { group, hint: restStems[restStems.length - 1], length: f.length };
      }
    }
  }
  return best ? { group: best.group, hint: best.hint } : null;
}

export function matchFridaEstimate(
  product: ProductForFridaMatch,
  groups: FridaTypeGroup[],
  adminChoices: Map<string, string | null> = new Map(),
): FridaMatch {
  const core = coreProductType(product);
  let group = bestTypeGroup(core, groups);
  let hint: string | null = null;
  if (!group) {
    const compound = compoundGroup(core, groups);
    if (!compound) return { kind: "none" };
    group = compound.group;
    hint = compound.hint;
  }

  const reviewKey = reviewKeyFor(hint ? `${group.typeLabel} ${hint}` : group.typeLabel, product);
  if (adminChoices.has(reviewKey)) {
    const chosen = adminChoices.get(reviewKey);
    const reference = chosen ? group.references.find((r) => r.id === chosen) : undefined;
    // "Ingen passer" (null) eller en Frida-vare, der ikke findes mere: intet skøn.
    return reference ? { kind: "match", reference, reviewKey } : { kind: "none" };
  }

  const typeLabel = group.typeLabel;
  const scored = group.references
    .map((reference) => ({ reference, ...scoreCandidate(product, reference, typeLabel, hint) }))
    .sort((a, b) => b.score - a.score);
  const usable = scored.filter((s) => s.compatible);
  const review = (candidates: typeof scored, reason: string): FridaMatch => ({
    kind: "review",
    candidates: candidates.map((s) => s.reference),
    reviewKey,
    typeLabel: hint ? `${typeLabel} (${hint})` : typeLabel,
    reason,
  });

  if (!usable.length) return review(scored, "Ingen Frida-vare passer på tilstand, fedtprocent eller alkohol");
  // Varen har en fedtprocent, og typens Frida-varer har det også, men ingen
  // passer: en vare uden fedtprocent er ikke et bedre bud.
  if (scored.some((s) => s.fatMatters) && !usable.some((s) => s.fatMatters)) {
    return review(scored, "Ingen Frida-vare har samme fedtprocent");
  }
  const top = usable[0];
  // Uden tilstand på varen må robotten kun selv vælge en rå vare eller en
  // uden tilstand, ikke fx en vare på dåse eller tørret.
  if (!top.wantsState && !top.neutral) return review(usable, "Frida har ingen rå vare eller vare uden tilstand");
  const ties = usable.filter((s) => s.score === top.score);
  if (ties.length > 1) return review(ties, `${ties.length} lige gode Frida-varer`);
  return { kind: "match", reference: top.reference, reviewKey };
}
