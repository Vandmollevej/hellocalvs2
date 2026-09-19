import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Bruges når et AI-resultat rettes efter den oprindelige produktoprettelse,
// fx fra admin. Den normale /api/products POST gemmer allerede korrektionerne
// automatisk under oprettelsen.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const analysisId = typeof body?.analysisId === "string" ? body.analysisId : "";
  const productId = typeof body?.productId === "string" ? body.productId : undefined;
  const correction = body?.correction;

  if (!analysisId || !correction || typeof correction !== "object" || Array.isArray(correction)) {
    return NextResponse.json({ message: "analysisId og correction er påkrævet" }, { status: 400 });
  }

  try {
    const result = await prisma.aiProductAnalysis.update({
      where: { id: analysisId },
      data: {
        correction,
        correctedAt: new Date(),
        ...(productId ? { productId } : {}),
      },
      select: { id: true, correctedAt: true },
    });
    return NextResponse.json({ feedback: result });
  } catch (error) {
    console.error("AI feedback save failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme feedback" }, { status: 503 });
  }
}
