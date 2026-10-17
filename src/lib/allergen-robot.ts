import { prisma } from "@/lib/prisma";
import { debugLog } from "@/lib/debug-log";
import { fingerprint } from "@/lib/spelling-robot";
import { approvedAllergenWords, invalidateAllergenWords } from "@/lib/allergen-words";
import { buildReferenceLookup, findAllergenWordCandidates, type ReferenceLookup } from "@/lib/allergen-word-finder";
import type { JobResult } from "@/lib/jobs/runs";

// Nattens allergen-robot (job "allergen-words", docs/DECISIONS.md 2026-10-17).
// Brugerens krav: "en robot som gennemgår nye hver nat og giver en rapport,
// når der er fundet nye ord".
//
// 1. Henter Open Food Facts' åbne opslagsværk (allergen- og ingrediens-
//    taksonomien) — fejler hentningen, kører robotten videre på STORT alene.
// 2. Læser kun nye og ændrede ingredienslister (fingeraftryk i
//    allergen_word_scans).
// 3. Nye ord, opslagsværket kender som allergen, godkendes straks og vises
//    med STORT + link overalt. Ord, kun producenten har skrevet med STORT,
//    venter på admin → Allergen-ord.
// 4. Rapporten: kørslens besked, siden Allergen-ord og en admin-advarsel
//    (banner + advarselsmail) i et døgn, når der er fundet nye ord.

const BATCH = 1000;
const MAX_SCANS_PER_RUN = 60_000;
const TAXONOMY_HOSTS = ["https://static.openfoodfacts.org", "https://world.openfoodfacts.org"];

const pause = () => new Promise((resolve) => setImmediate(resolve));

async function fetchTaxonomy(name: string): Promise<Record<string, never> | null> {
  for (const host of TAXONOMY_HOSTS) {
    try {
      const response = await fetch(`${host}/data/taxonomies/${name}.json`, {
        signal: AbortSignal.timeout(120_000),
        headers: { "User-Agent": "HelloCal/1.0 (allergen-robot)" },
      });
      if (response.ok) return (await response.json()) as Record<string, never>;
    } catch {
      // prøv næste vært
    }
  }
  return null;
}

async function loadReference(): Promise<{ lookup: ReferenceLookup; note: string | null }> {
  const [allergens, ingredients] = await Promise.all([fetchTaxonomy("allergens"), fetchTaxonomy("ingredients")]);
  const lookup = buildReferenceLookup(allergens, ingredients);
  const missing = [!allergens && "allergener", !ingredients && "ingredienser"].filter(Boolean);
  return { lookup, note: missing.length ? `Open Food Facts kunne ikke hentes (${missing.join(", ")})` : null };
}

type Found = { word: string; allergenKey: string | null; source: string; language: string | null; productId: string; context: string; count: number };

export async function runAllergenWordCheck(): Promise<JobResult> {
  const startedAt = Date.now();
  const { lookup, note } = await loadReference();
  const extra = await approvedAllergenWords();
  const known = new Set((await prisma.allergenWord.findMany({ select: { word: true } })).map((row) => row.word));
  const scans = new Map((await prisma.allergenWordScan.findMany({ select: { productId: true, fingerprint: true } })).map((row) => [row.productId, row.fingerprint]));

  const found = new Map<string, Found>();
  const seenAgain = new Map<string, number>();
  let scanned = 0;
  let remaining = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.product.findMany({
      where: { deletedAt: null, ingredientsText: { not: null } },
      select: { id: true, ingredientsText: true, language: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    const done: { productId: string; fingerprint: string }[] = [];
    for (const row of rows) {
      const text = row.ingredientsText ?? "";
      const print = fingerprint(text);
      if (scans.get(row.id) === print) continue;
      if (scanned >= MAX_SCANS_PER_RUN) {
        remaining += 1;
        continue;
      }
      scanned += 1;
      done.push({ productId: row.id, fingerprint: print });
      for (const candidate of findAllergenWordCandidates(text, row.language, lookup, extra)) {
        if (known.has(candidate.word)) {
          seenAgain.set(candidate.word, (seenAgain.get(candidate.word) ?? 0) + 1);
          continue;
        }
        const existing = found.get(candidate.word);
        if (existing) {
          existing.count += 1;
          // Et opslagsværk-fund vinder over et STORT-fund for samme ord.
          if (!existing.allergenKey && candidate.allergenKey) Object.assign(existing, { allergenKey: candidate.allergenKey, source: candidate.source });
          continue;
        }
        found.set(candidate.word, { ...candidate, language: row.language, productId: row.id, count: 1 });
      }
    }
    if (done.length) {
      await prisma.allergenWordScan.deleteMany({ where: { productId: { in: done.map((item) => item.productId) } } });
      await prisma.allergenWordScan.createMany({ data: done, skipDuplicates: true });
    }
    await pause();
  }

  const newWords = [...found.values()];
  if (newWords.length) {
    await prisma.allergenWord.createMany({
      data: newWords.map((item) => ({
        word: item.word,
        allergenKey: item.allergenKey,
        status: item.source === "reference" ? ("APPROVED" as const) : ("PENDING" as const),
        source: item.source,
        language: item.language,
        productCount: item.count,
        exampleProductId: item.productId,
        exampleContext: item.context.slice(0, 200),
      })),
      skipDuplicates: true,
    });
    invalidateAllergenWords();
  }
  for (const [word, count] of seenAgain) {
    await prisma.allergenWord.update({ where: { word }, data: { productCount: { increment: count } } }).catch(() => undefined);
  }

  const approved = newWords.filter((item) => item.source === "reference");
  const pending = newWords.filter((item) => item.source !== "reference");
  const list = (items: Found[]) => items.slice(0, 15).map((item) => item.word.toUpperCase()).join(", ") + (items.length > 15 ? " …" : "");
  const message =
    `${scanned} lister læst. ` +
    (newWords.length
      ? `Nye ord: ${approved.length} godkendt via Open Food Facts${approved.length ? ` (${list(approved)})` : ""}, ${pending.length} til gennemsyn${pending.length ? ` (${list(pending)})` : ""}.`
      : "Ingen nye allergen-ord.") +
    (remaining ? ` ${remaining} lister venter til næste nat.` : "") +
    (note ? ` ${note}.` : "");
  void debugLog({
    category: "cron",
    event: "allergen_words",
    message: `Allergen-robot: ${message}`,
    durationMs: Date.now() - startedAt,
    data: { scanned, approved: approved.length, pending: pending.length, remaining, referenceLanguages: lookup.size },
  });
  return { message, count: newWords.length };
}
