import { prisma } from "@/lib/prisma";
import { obviousNonsense } from "@/lib/search-analytics-rules";

// Vurdering af søgninger uden resultat (docs/DECISIONS.md 2026-10-10), så admin
// → Analyse → Søgning kan vise rene fejl: varer og mærker, vi faktisk mangler.
//   TYPO     stavefejl (rettelse i suggestion)
//   NONSENSE ikke rigtige ord, test-tastning
//   MISSING  en rigtig vare, ret eller mærke, som ikke findes i databasen
// Regler først (meningsløse tegn, søgninger appen selv rettede); resten vurderes
// af AI i hold. Uden OPENAI_API_KEY bliver de stående som ikke vurderet.

export const MISS_KINDS = ["TYPO", "NONSENSE", "MISSING"] as const;
export type MissKind = (typeof MISS_KINDS)[number];

const LOOKBACK_DAYS = 90;
const MAX_PER_RUN = 300;
const AI_BATCH = 50;

type AiVerdict = { query: string; kind: MissKind; suggestion?: string | null };

async function classifyWithAi(queries: string[]): Promise<AiVerdict[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || queries.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Du vurderer søgninger i en dansk kalorie-app (madvarer, drikkevarer, mærker, retter; brugerne skriver også på " +
            "engelsk, tysk, svensk og norsk). Søgningerne gav ingen varer. Klassificér hver søgning: " +
            '"TYPO" = stavefejl af et rigtigt ord, en vare eller et mærke (angiv den rettede søgning i suggestion); ' +
            '"NONSENSE" = ikke rigtige ord, tilfældige tegn, test eller noget, der ikke kan spises/drikkes; ' +
            '"MISSING" = en rigtig vare, ret, ingrediens eller et mærke, stavet rigtigt (suggestion = null). ' +
            'Svar som JSON: {"results": [{"query": string, "kind": "TYPO"|"NONSENSE"|"MISSING", "suggestion": string|null}]}.',
        },
        { role: "user", content: JSON.stringify({ queries }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { results?: AiVerdict[] };
  const wanted = new Set(queries);
  return (parsed.results ?? []).filter(
    (row) => row && wanted.has(row.query) && (MISS_KINDS as readonly string[]).includes(row.kind),
  );
}

export async function reviewSearchMisses(): Promise<{ message: string; count: number }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const misses = await prisma.searchEvent.groupBy({
    by: ["normalizedQuery"],
    where: { fullMatchCount: 0, createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { normalizedQuery: "desc" } },
    take: 5_000,
  });
  const reviewed = new Set(
    (
      await prisma.searchQueryReview.findMany({
        where: { normalizedQuery: { in: misses.map((m) => m.normalizedQuery) } },
        select: { normalizedQuery: true },
      })
    ).map((row) => row.normalizedQuery),
  );
  const pending = misses.map((m) => m.normalizedQuery).filter((q) => !reviewed.has(q)).slice(0, MAX_PER_RUN);
  if (pending.length === 0) return { message: "Ingen nye søgninger uden resultat at vurdere", count: 0 };

  // Søgninger, appen selv rettede til noget med resultater ("Viser resultater for …").
  const corrected = await prisma.searchEvent.findMany({
    where: { normalizedQuery: { in: pending }, correctedQuery: { not: null } },
    select: { normalizedQuery: true, correctedQuery: true },
    distinct: ["normalizedQuery"],
  });
  const correctedBy = new Map(corrected.map((row) => [row.normalizedQuery, row.correctedQuery as string]));

  const verdicts: Array<{ normalizedQuery: string; kind: MissKind; suggestion: string | null; source: string }> = [];
  const forAi: string[] = [];
  for (const query of pending) {
    if (obviousNonsense(query)) verdicts.push({ normalizedQuery: query, kind: "NONSENSE", suggestion: null, source: "rules" });
    else if (correctedBy.has(query))
      verdicts.push({ normalizedQuery: query, kind: "TYPO", suggestion: correctedBy.get(query)!, source: "rules" });
    else forAi.push(query);
  }

  let aiFailed = false;
  for (let i = 0; i < forAi.length; i += AI_BATCH) {
    try {
      for (const row of await classifyWithAi(forAi.slice(i, i + AI_BATCH))) {
        verdicts.push({
          normalizedQuery: row.query,
          kind: row.kind,
          suggestion: row.kind === "TYPO" && row.suggestion ? String(row.suggestion).slice(0, 120) : null,
          source: "ai",
        });
      }
    } catch (error) {
      console.error("Search miss AI review failed", error);
      aiFailed = true;
      break;
    }
  }

  for (const verdict of verdicts) {
    await prisma.searchQueryReview.upsert({
      where: { normalizedQuery: verdict.normalizedQuery },
      create: verdict,
      update: { kind: verdict.kind, suggestion: verdict.suggestion, source: verdict.source },
    });
  }
  const counts = MISS_KINDS.map((kind) => `${verdicts.filter((v) => v.kind === kind).length} ${kind}`).join(", ");
  const left = pending.length - verdicts.length;
  return {
    message:
      `${verdicts.length} søgninger uden resultat vurderet (${counts})` +
      (left > 0 ? `; ${left} ikke vurderet${aiFailed ? " (AI-fejl)" : process.env.OPENAI_API_KEY ? "" : " (OPENAI_API_KEY mangler)"}` : ""),
    count: verdicts.length,
  };
}
