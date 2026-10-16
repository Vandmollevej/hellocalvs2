import { prisma } from "@/lib/prisma";
import { locate, replaceAt } from "@/lib/spelling-engine";
import { invalidateSpellingDictionary } from "@/lib/spelling-dictionary";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";

// Admins afgørelser på admin → Stavekontrol (docs/DECISIONS.md 2026-10-14).
// Hver afgørelse retter varen og lærer ordbogen (spelling_rules), så samme
// fejl rettes af sig selv næste gang — både af nattens robot og når en ny
// vare scannes:
// - Godkend: robottens forslag eller admins egen rettelse skrives i varen;
//   reglen "ord → rettelse" gemmes.
// - Afvis: ordet er rigtigt; reglen "ord er rigtigt" gemmes.
// - Fortryd: en rettelse (robottens eller admins) tages tilbage; ordet
//   regnes derefter for rigtigt.

export type ReviewOutcome = { ok: number; failed: { id: string; reason: string }[] };

// Ordbogen gemmer rettelsen med små bogstaver, medmindre store/små bogstaver
// betyder noget ("McCain"); stavemotoren giver den samme form som ordet.
function ruleReplacement(replacement: string): string {
  const plain =
    replacement === replacement.toLowerCase() ||
    replacement === replacement.toUpperCase() ||
    replacement.slice(1) === replacement.slice(1).toLowerCase();
  return plain ? replacement.toLowerCase() : replacement;
}

function isSingleWord(word: string) {
  return /^[\p{L}\d'-]+$/u.test(word);
}

// Kun ord-for-ord-afgørelser bliver regler: en sletning (volapyk) og en
// rettelse til flere ord ("SESAMFRØ (ristet)") gælder kun den ene vare.
async function saveRule(word: string, replacement: string | null, adminId: string) {
  if (!isSingleWord(word) || replacement === "" || (replacement !== null && !isSingleWord(replacement))) return;
  const key = word.toLowerCase();
  await prisma.spellingRule.upsert({
    where: { word: key },
    create: { word: key, replacement, createdById: adminId },
    update: { replacement, createdById: adminId, createdAt: new Date() },
  });
}

async function writeProductText(productId: string, before: string, after: string): Promise<boolean> {
  if (before === after) return true;
  const updated = await prisma.product.updateMany({ where: { id: productId, ingredientsText: before }, data: { ingredientsText: after } });
  if (!updated.count) return false;
  await syncProductNutritionFeaturesSafely(productId);
  return true;
}

async function loadIssues(ids: string[]) {
  return prisma.spellingIssue.findMany({ where: { id: { in: ids } } });
}

async function productText(productId: string): Promise<string | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { ingredientsText: true } });
  return product?.ingredientsText ?? null;
}

export async function acceptSpellingIssues(
  ids: string[],
  ownTexts: Record<string, string>,
  adminId: string,
): Promise<ReviewOutcome> {
  const outcome: ReviewOutcome = { ok: 0, failed: [] };
  for (const issue of await loadIssues(ids)) {
    const own = ownTexts[issue.id]?.trim();
    const replacement = own || issue.suggestion;
    if (replacement === null || replacement === undefined) {
      outcome.failed.push({ id: issue.id, reason: "Intet forslag — skriv din egen rettelse" });
      continue;
    }
    if (issue.status === "ACCEPTED" && !own) {
      outcome.ok += 1;
      continue;
    }
    const text = await productText(issue.productId);
    if (text === null) {
      outcome.failed.push({ id: issue.id, reason: "Varen findes ikke længere" });
      continue;
    }
    // Ventende fund: ordet står der stadig. Allerede rettede: robottens rettelse
    // står der og skiftes ud med admins egen.
    const current = issue.status === "PENDING" || issue.status === "REJECTED" || issue.status === "REVERTED" ? issue.word : issue.appliedText;
    const at = current ? locate(text, current, issue.position) : null;
    if (at === null || !current) {
      outcome.failed.push({ id: issue.id, reason: `"${current || issue.word}" står ikke længere i listen` });
      continue;
    }
    const next = replaceAt(text, at, at + current.length, replacement);
    if (!(await writeProductText(issue.productId, text, next))) {
      outcome.failed.push({ id: issue.id, reason: "Listen blev ændret imens — prøv igen" });
      continue;
    }
    await prisma.spellingIssue.update({
      where: { id: issue.id },
      data: { status: "ACCEPTED", appliedText: replacement, reviewedAt: new Date(), reviewedById: adminId },
    });
    if (issue.reason !== "nutrition") await saveRule(issue.word, ruleReplacement(replacement), adminId);
    outcome.ok += 1;
  }
  invalidateSpellingDictionary();
  return outcome;
}

export async function rejectSpellingIssues(ids: string[], adminId: string): Promise<ReviewOutcome> {
  const outcome: ReviewOutcome = { ok: 0, failed: [] };
  const issues = await loadIssues(ids);
  // En allerede lavet rettelse afvises ved at fortryde den.
  const applied = issues.filter((issue) => issue.status === "AUTO_FIXED" || issue.status === "ACCEPTED");
  if (applied.length) {
    const reverted = await revertSpellingIssues(applied.map((issue) => issue.id), adminId);
    outcome.ok += reverted.ok;
    outcome.failed.push(...reverted.failed);
  }
  for (const issue of issues.filter((item) => item.status === "PENDING")) {
    await prisma.spellingIssue.update({ where: { id: issue.id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: adminId } });
    if (issue.reason !== "nutrition") await saveRule(issue.word, null, adminId);
    outcome.ok += 1;
  }
  invalidateSpellingDictionary();
  return outcome;
}

export async function revertSpellingIssues(ids: string[], adminId: string): Promise<ReviewOutcome> {
  const outcome: ReviewOutcome = { ok: 0, failed: [] };
  for (const issue of await loadIssues(ids)) {
    if (issue.status !== "AUTO_FIXED" && issue.status !== "ACCEPTED") {
      outcome.failed.push({ id: issue.id, reason: "Kun lavede rettelser kan fortrydes" });
      continue;
    }
    const text = await productText(issue.productId);
    if (text === null) {
      outcome.failed.push({ id: issue.id, reason: "Varen findes ikke længere" });
      continue;
    }
    let next: string | null = null;
    if (issue.appliedText) {
      const at = locate(text, issue.appliedText, issue.position);
      if (at !== null) next = replaceAt(text, at, at + issue.appliedText.length, issue.word);
    } else {
      // Et slettet stykke sættes ind igen (næringstabellen bagerst).
      next =
        issue.reason === "nutrition" || issue.position >= text.length
          ? `${text}${/^\s/.test(issue.word) ? "" : " "}${issue.word}`
          : `${text.slice(0, issue.position)}${issue.word} ${text.slice(issue.position)}`;
    }
    if (next === null || !(await writeProductText(issue.productId, text, next))) {
      outcome.failed.push({ id: issue.id, reason: "Rettelsen står ikke længere i listen" });
      continue;
    }
    await prisma.spellingIssue.update({ where: { id: issue.id }, data: { status: "REVERTED", reviewedAt: new Date(), reviewedById: adminId } });
    if (issue.reason !== "nutrition") await saveRule(issue.word, null, adminId);
    outcome.ok += 1;
  }
  invalidateSpellingDictionary();
  return outcome;
}
