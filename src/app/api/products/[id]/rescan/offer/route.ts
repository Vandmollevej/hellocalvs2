import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// POST /api/products/[id]/rescan/offer — banneret "Optjen 10 points" er vist
// for første gang (docs/DECISIONS.md 2026-10-02). Scanner ingen varen igen,
// læser den natlige robot (job "external-image-ai") Open Food Facts-billedet
// med OpenAI i stedet. Kun det første tidspunkt gemmes.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await prisma.product.updateMany({ where: { id, rescanOfferedAt: null }, data: { rescanOfferedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Rescan offer could not be saved", id, error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
