import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyCorrections,
  correctableWord,
  escapeLike,
  maxEditDistance,
  splitQueryTokens,
} from "@/lib/search-correction-rules";

// Accent-ufølsom søgning og "Mente du …?" (docs/DECISIONS.md 2026-10-10).
// Bygger på hc_search_norm() og materialiseret visning search_words
// (migration 20261010120000_search_unaccent_trgm). Fejl her må aldrig vælte
// en søgning: alle opslag returnerer tomt ved fejl.

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
let lastRefresh = 0;
let refreshing = false;

// Ordlisten genopbygges i baggrunden, når den er ældre end få timer (varer
// importeres dagligt). CONCURRENTLY blokerer ikke igangværende søgninger.
export function refreshSearchWordsIfStale() {
  if (refreshing || Date.now() - lastRefresh < REFRESH_AFTER_MS) return;
  refreshing = true;
  prisma
    .$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY search_words`
    .then(() => {
      lastRefresh = Date.now();
    })
    .catch((error) => console.error("Could not refresh search_words", error))
    .finally(() => {
      refreshing = false;
    });
}

function likePattern(word: string) {
  return Prisma.sql`'%' || hc_search_norm(${escapeLike(word)}) || '%'`;
}

// Søgeordet uden mellemrum og tegn, til sammenligning med teksten uden mellemrum.
function tightLikePattern(word: string) {
  return Prisma.sql`'%' || regexp_replace(hc_search_norm(${escapeLike(word)}), '[[:space:][:punct:]]+', '', 'g') || '%'`;
}

// Id'er på varer, hvor hvert ord i søgningen står i navn, flertalsnavn, mærke,
// serie, varetype, variant, smag eller søgeord — uden hensyn til store/små
// bogstaver og accenter ("Nescafé" finder "Nescafe"), og også når teksten læses
// uden mellemrum, så sammensatte ord matcher ("instantkaffe" finder "Instant
// Kaffe", "instant kaffe" finder "Instantkaffe"). docs/DECISIONS.md 2026-10-10.
export async function accentInsensitiveProductIds(query: string, limit = 1000): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const words = splitQueryTokens(q).filter((word) => word.length >= 2).slice(0, 6);
  if (words.length === 0) return [];
  const everyWord = Prisma.join(
    words.map((word) => Prisma.sql`(x."text" LIKE ${likePattern(word)} OR x."tight" LIKE ${tightLikePattern(word)})`),
    " AND ",
  );
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT x."id" FROM (
        SELECT t."id", t."createdAt", t."text", regexp_replace(t."text", '[[:space:][:punct:]]+', '', 'g') AS "tight"
        FROM (
          SELECT p."id", p."createdAt", hc_search_norm(concat_ws(' ', p."name", p."namePlural", b."name",
            p."subbrand", p."productType", p."variant", p."flavor", array_to_string(p."keywords", ' '))) AS "text"
          FROM "products" p LEFT JOIN "brands" b ON b."id" = p."brandId"
          WHERE NOT p."discontinued" AND p."privateOwnerId" IS NULL
        ) t
      ) x
      WHERE ${everyWord}
      ORDER BY x."createdAt" DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  } catch (error) {
    console.error("Accent-insensitive search failed", error);
    return [];
  }
}

// Det nærmeste ord i ordlisten (mest brugte ved lige afstand). Et ord, som
// allerede findes eller er begyndelsen på et ord ("nesc"), rettes aldrig, så
// man ikke bliver rettet midt i at skrive.
async function nearestWord(token: string): Promise<string | null> {
  const max = maxEditDistance(token.length);
  const rows = await prisma.$queryRaw<{ word: string }[]>`
    SELECT w."word" FROM "search_words" w, (SELECT hc_search_norm(${token}) AS n) q
    WHERE NOT EXISTS (SELECT 1 FROM "search_words" p WHERE starts_with(p."norm", q.n))
      AND abs(length(w."norm") - length(q.n)) <= ${max}::int
      AND levenshtein(w."norm", q.n) BETWEEN 1 AND ${max}::int
    ORDER BY levenshtein(w."norm", q.n), w."freq" DESC
    LIMIT 1`;
  return rows[0]?.word ?? null;
}

// Den rettede søgning, eller null når intet ord kan rettes.
export async function correctedQuery(query: string): Promise<string | null> {
  const tokens = splitQueryTokens(query).slice(0, 6);
  if (!tokens.some(correctableWord)) return null;
  refreshSearchWordsIfStale();
  try {
    const corrections = new Map<string, string>();
    for (const token of new Set(tokens.filter(correctableWord))) {
      const fixed = await nearestWord(token);
      if (fixed) corrections.set(token, fixed);
    }
    return applyCorrections(query, corrections);
  } catch (error) {
    console.error("Search correction failed", error);
    return null;
  }
}
