import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { looksDanish } from "@/lib/ingredient-text-quality";
import {
  AUTO_FIX_CONFIDENCE,
  CORPUS_MIN_PRODUCTS,
  contextAround,
  findSpellingIssues,
  replaceAt,
  tokenize,
  type SpellingDictionary,
  type SpellingFinding,
} from "@/lib/spelling-engine";
import { buildSpellingDictionary, invalidateSpellingDictionary } from "@/lib/spelling-dictionary";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { debugLog } from "@/lib/debug-log";
import type { JobResult } from "@/lib/jobs/runs";

// Nattens stavekontrol-robot (job "spelling-check", docs/DECISIONS.md
// 2026-10-14). Brugerens krav: "en natlig robot som scanner stavefejl og
// leverer en fuld rapport over ændringer og observationer som ikke kunne
// ændres grundet usikkerhed".
//
// 1. Katalogets ordforråd: alle danske ingredienslister læses, og hvert ords
//    antal varer gemmes (spelling_words). Ord i mindst CORPUS_MIN_PRODUCTS
//    varer er kendte — ordbogen vokser med kataloget i stedet for en
//    hårdkodet liste.
// 2. Lister, der er nye eller ændret siden sidst (fingeraftryk i
//    spelling_scans), køres gennem stavemotoren med ordforrådet + admins
//    afgørelser (spelling_rules).
// 3. Sikre fund (≥ AUTO_FIX_CONFIDENCE) rettes i varen og gemmes som
//    AUTO_FIXED med ordet før/efter (kan fortrydes). Usikre gemmes som
//    PENDING til admin → Stavekontrol. Kun danske lister.

const BATCH = 250;
// Højst så mange ændrede lister pr. nat (første kørsel tager resten de
// følgende nætter); robotten kører i app-processen og må ikke låse den.
const MAX_SCANS_PER_RUN = 60_000;

export function fingerprint(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

const pause = () => new Promise((resolve) => setImmediate(resolve));

type Row = { id: string; ingredientsText: string | null };

async function* productBatches(): AsyncGenerator<Row[]> {
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.product.findMany({
      where: { deletedAt: null, ingredientsText: { not: null } },
      select: { id: true, ingredientsText: true },
      orderBy: { id: "asc" },
      take: BATCH * 4,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) return;
    yield rows;
    cursor = rows[rows.length - 1].id;
    await pause();
  }
}

async function buildCorpus(): Promise<Map<string, number>> {
  const frequency = new Map<string, number>();
  for await (const rows of productBatches()) {
    for (const row of rows) {
      const text = row.ingredientsText ?? "";
      if (!looksDanish(text)) continue;
      const words = new Set(tokenize(text).map((token) => token.text.toLowerCase()).filter((word) => /^[a-zæøå]{3,}$/.test(word)));
      for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }
  return frequency;
}

async function saveCorpus(frequency: Map<string, number>) {
  const rows = [...frequency].filter(([, count]) => count >= CORPUS_MIN_PRODUCTS).map(([word, productCount]) => ({ word, productCount }));
  await prisma.$transaction(async (tx) => {
    await tx.spellingWord.deleteMany({});
    for (let index = 0; index < rows.length; index += 5000) {
      await tx.spellingWord.createMany({ data: rows.slice(index, index + 5000), skipDuplicates: true });
    }
  }, { timeout: 120_000 });
  return rows.length;
}

export function isSafeFinding(finding: SpellingFinding): boolean {
  return finding.confidence >= AUTO_FIX_CONFIDENCE && (Boolean(finding.suggestion) || finding.reason === "nutrition");
}

// Én vares liste: sikre fund rettes, alle fund gemmes. Returnerer tal til rapporten.
async function checkProduct(
  productId: string,
  text: string,
  dictionary: SpellingDictionary,
  memo: Map<string, SpellingFinding[]>,
): Promise<{ autoFixed: number; pending: number; finalText: string }> {
  const findings = memo.get(text) ?? findSpellingIssues(text, dictionary, { reportUnknown: true });
  memo.set(text, findings);
  if (!findings.length) return { autoFixed: 0, pending: 0, finalText: text };

  // Allerede ventende fund gentages ikke, og hvad admin har afvist eller
  // fortrudt på varen, rettes aldrig igen (heller ikke næringstabellen).
  const earlier = await prisma.spellingIssue.findMany({
    where: { productId, status: { in: ["PENDING", "REJECTED", "REVERTED"] } },
    select: { word: true, status: true },
  });
  const openWords = new Set(earlier.filter((issue) => issue.status === "PENDING").map((issue) => issue.word));
  const decidedWords = new Set(earlier.filter((issue) => issue.status !== "PENDING").map((issue) => issue.word.trim()));

  let result = text;
  let autoFixed = 0;
  let pending = 0;
  const issues: Prisma.SpellingIssueCreateManyInput[] = [];
  // Bagfra, så placeringerne foran stadig passer.
  for (const finding of [...findings].reverse()) {
    if (decidedWords.has(finding.word.trim())) continue;
    const context = contextAround(text, finding.start, finding.end);
    const base = {
      productId,
      word: finding.word,
      suggestion: finding.suggestion,
      confidence: finding.confidence,
      reason: finding.reason,
      contextBefore: context.before,
      contextAfter: context.after,
      position: finding.start,
    };
    if (isSafeFinding(finding)) {
      result = replaceAt(result, finding.start, finding.end, finding.suggestion ?? "");
      issues.push({ ...base, status: "AUTO_FIXED", appliedText: finding.suggestion ?? "" });
      autoFixed += 1;
    } else if (!openWords.has(finding.word)) {
      issues.push({ ...base, status: "PENDING" });
      pending += 1;
    }
  }

  if (result !== text) {
    // Kun hvis listen ikke er ændret imens (brugeren/admin kan have rettet den).
    const updated = await prisma.product.updateMany({ where: { id: productId, ingredientsText: text }, data: { ingredientsText: result } });
    if (!updated.count) return { autoFixed: 0, pending: 0, finalText: text };
    await syncProductNutritionFeaturesSafely(productId);
  }
  if (issues.length) await prisma.spellingIssue.createMany({ data: issues });
  return { autoFixed, pending, finalText: result };
}

export async function runSpellingCheck(): Promise<JobResult> {
  const startedAt = Date.now();
  const frequency = await buildCorpus();
  const corpusWords = await saveCorpus(frequency);
  invalidateSpellingDictionary();
  const dictionary = await buildSpellingDictionary(frequency);

  const scans = new Map(
    (await prisma.spellingScan.findMany({ select: { productId: true, fingerprint: true } })).map((row) => [row.productId, row.fingerprint]),
  );
  const memo = new Map<string, SpellingFinding[]>();
  let scanned = 0;
  let autoFixed = 0;
  let pending = 0;
  let skippedLanguage = 0;
  let remaining = 0;

  for await (const rows of productBatches()) {
    for (const row of rows) {
      const text = row.ingredientsText ?? "";
      const print = fingerprint(text);
      if (scans.get(row.id) === print) continue;
      if (scanned >= MAX_SCANS_PER_RUN) {
        remaining += 1;
        continue;
      }
      if (!looksDanish(text)) {
        skippedLanguage += 1;
        await prisma.spellingScan.upsert({ where: { productId: row.id }, create: { productId: row.id, fingerprint: print }, update: { fingerprint: print, scannedAt: new Date() } });
        continue;
      }
      const outcome = await checkProduct(row.id, text, dictionary, memo);
      scanned += 1;
      autoFixed += outcome.autoFixed;
      pending += outcome.pending;
      const finalPrint = fingerprint(outcome.finalText);
      await prisma.spellingScan.upsert({
        where: { productId: row.id },
        create: { productId: row.id, fingerprint: finalPrint },
        update: { fingerprint: finalPrint, scannedAt: new Date() },
      });
      if (scanned % BATCH === 0) await pause();
    }
  }

  const message =
    `${scanned} lister læst, ${autoFixed} rettet automatisk, ${pending} til gennemsyn` +
    (skippedLanguage ? `, ${skippedLanguage} ikke-danske sprunget over` : "") +
    (remaining ? `, ${remaining} venter til næste nat` : "") +
    ` (ordforråd: ${corpusWords} ord)`;
  void debugLog({
    category: "cron",
    event: "spelling_check",
    message: `Stavekontrol: ${message}`,
    durationMs: Date.now() - startedAt,
    data: { scanned, autoFixed, pending, skippedLanguage, remaining, corpusWords },
  });
  return { message, count: autoFixed + pending };
}
