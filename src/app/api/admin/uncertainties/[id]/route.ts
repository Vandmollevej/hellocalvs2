import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { CORRECTION_ERRORS, applyAnalysisValues } from "@/lib/uncertainty-corrections";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24/25): gemmer adminens
// rettelse fra redigerings-lightboxen. Værdierne skrives til produktet, og
// analysen markeres som gennemgået (reviewedAt), så den forsvinder fra
// listen og produktet igen vises i søgningen. Rettelsen gemmes som
// correction (træningsdata).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const values = body?.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : null;
  if (!values) return NextResponse.json({ message: "values er påkrævet" }, { status: 400 });

  const analysis = await prisma.aiProductAnalysis.findUnique({
    where: { id },
    include: { product: { select: { id: true, productType: true } } },
  });
  if (!analysis?.product) return NextResponse.json({ message: "Analysen findes ikke" }, { status: 404 });
  if (analysis.reviewedAt) return NextResponse.json({ message: "Allerede gennemgået" }, { status: 409 });
  const product = analysis.product;

  try {
    await prisma.$transaction(async (tx) => {
      await applyAnalysisValues(tx, analysis, product, values);
      const now = new Date();
      await tx.aiProductAnalysis.update({
        where: { id },
        data: { correction: values as Prisma.InputJsonValue, correctedAt: now, reviewedAt: now },
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (CORRECTION_ERRORS[code]) return NextResponse.json({ message: CORRECTION_ERRORS[code] }, { status: 400 });
    console.error("Uncertainty correction failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
