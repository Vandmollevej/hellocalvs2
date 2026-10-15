import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bestTextMatch } from "@/lib/text-similarity";
import { matchBrandInTexts, type BrandCandidate } from "@/lib/brand-match";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// POST /api/products/recognize-text — { text: string (OCR-læst emballagetekst) }
//
// Lokal, gratis produktgenkendelse (ingen AI): finder kandidatprodukter ud
// fra et par ord i teksten og fuzzy-matcher hele teksten mod
// "mærke + navn" med et 90%-threshold, jf. krav 3 i det guidede
// kamera-auto-flow (/camera/create). Bruges FØR AI-vision-fallback.
//
// Forlæsningen i Tilføj-kameraet (docs/DECISIONS.md 2026-10-15) kalder den
// løbende, mens brugeren sigter (`preRead: true`): svaret har også et kendt
// mærke, der står ordret i teksten (`brand`), og kun fund logges.

// Brandlisten hentes højst hvert femte minut (forlæsningen kalder ofte).
const BRAND_CACHE_MS = 5 * 60 * 1000;
let brandCache: { at: number; brands: BrandCandidate[] } | null = null;

async function knownBrands(): Promise<BrandCandidate[]> {
  if (brandCache && Date.now() - brandCache.at < BRAND_CACHE_MS) return brandCache.brands;
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  brandCache = { at: Date.now(), brands };
  return brands;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  const preRead = body?.preRead === true;
  if (!text) {
    return NextResponse.json({ product: null, brand: null });
  }

  // Byg et bredt, men afgrænset kandidatsæt: de mest markante ord (>3 tegn)
  // i den OCR-læste tekst bruges som søgeord mod produktnavnet.
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((w: string) => w.length > 3)
    .slice(0, 5);

  try {
    const candidates = await prisma.product.findMany({
      where: {
        discontinued: false,
        nutritionMissing: false,
        ...(words.length
          ? { OR: words.map((w: string) => ({ name: { contains: w, mode: "insensitive" as const } })) }
          : {}),
      },
      include: { brand: true },
      take: 100,
    });

    const best = bestTextMatch(text, candidates, (c) => `${c.brand?.name ?? ""} ${c.name}`.trim(), 0.9);
    const brand = matchBrandInTexts([text], await knownBrands().catch(() => []));
    if (!preRead || best) void debugLog({
      category: "scan",
      event: "front_duplicate_check",
      message: best
        ? `Forsideteksten matcher "${`${best.candidate.brand?.name ?? ""} ${best.candidate.name}`.trim()}" (${Math.round(best.score * 100)} %)`
        : `Ingen eksisterende vare matcher forsideteksten (${candidates.length} kandidater)`,
      flowId: flowIdFromRequest(req),
      productId: best?.candidate.id ?? null,
      durationMs: Date.now() - startedAt,
      data: { words, candidates: candidates.length, score: best?.score ?? 0, brand: brand?.name ?? null, preRead },
    });
    return NextResponse.json({
      product: best?.candidate ?? null,
      score: best?.score ?? 0,
      brand: brand ? { id: brand.id, name: brand.name } : null,
    });
  } catch (error) {
    console.error("Text recognition failed", error);
    void debugLog({
      category: "scan",
      event: "front_duplicate_check",
      level: "error",
      message: `Dublet-tjekket fejlede: ${errorText(error)}`,
      flowId: flowIdFromRequest(req),
    });
    return NextResponse.json({ product: null, brand: null }, { status: 503 });
  }
}
