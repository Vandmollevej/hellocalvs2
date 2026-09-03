import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bestTextMatch } from "@/lib/text-similarity";

// POST /api/products/recognize-text — { text: string (OCR-læst emballagetekst) }
//
// Lokal, gratis produktgenkendelse (ingen AI): finder kandidatprodukter ud
// fra et par ord i teksten og fuzzy-matcher hele teksten mod
// "mærke + navn" med et 90%-threshold, jf. krav 3 i det guidede
// kamera-auto-flow (/camera/create). Bruges FØR AI-vision-fallback.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ product: null });
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
        ...(words.length
          ? { OR: words.map((w: string) => ({ name: { contains: w, mode: "insensitive" as const } })) }
          : {}),
      },
      include: { brand: true },
      take: 100,
    });

    const best = bestTextMatch(text, candidates, (c) => `${c.brand?.name ?? ""} ${c.name}`.trim(), 0.9);
    return NextResponse.json({ product: best?.candidate ?? null, score: best?.score ?? 0 });
  } catch (error) {
    console.error("Text recognition failed", error);
    return NextResponse.json({ product: null }, { status: 503 });
  }
}
