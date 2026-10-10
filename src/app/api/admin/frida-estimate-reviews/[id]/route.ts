import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";
import { requestFridaEstimatesRun } from "@/lib/frida-estimates";

// Admin "Usikkerheder" → Frida-match (docs/DECISIONS.md 2026-10-10): admin
// vælger Frida-varen til en produkttype + tilstand, robotten ikke selv kunne
// afgøre. { fridaProductId: "<id>" } = brug den, { fridaProductId: null } =
// ingen passer, { reset: true } = vælg igen. Robotten kører straks bagefter.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { fridaProductId?: string | null; reset?: boolean };

  const review = await prisma.fridaEstimateReview.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ message: "Ukendt Frida-match" }, { status: 404 });

  if (body.reset) {
    await prisma.fridaEstimateReview.update({ where: { id }, data: { decidedAt: null, chosenFridaProductId: null } });
  } else {
    const chosen = body.fridaProductId ?? null;
    if (chosen && !review.candidateIds.includes(chosen)) {
      return NextResponse.json({ message: "Frida-varen er ikke en af kandidaterne" }, { status: 400 });
    }
    await prisma.fridaEstimateReview.update({ where: { id }, data: { decidedAt: new Date(), chosenFridaProductId: chosen } });
  }
  await requestFridaEstimatesRun();
  return NextResponse.json({ ok: true });
}
