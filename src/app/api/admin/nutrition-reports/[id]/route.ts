import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { parseNutritionReportChanges } from "@/lib/nutrition-reports";

// Admin-afgørelse på en brugerindberettet næringsændring (docs/DECISIONS.md
// 2026-09-23). APPROVE skriver de indberettede pr.-100 g-værdier til
// produktet og markerer rapporten APPROVED i samme transaktion. REJECT
// markerer kun rapporten REJECTED — produktet røres ikke. Kun en PENDING
// rapport kan afgøres, så et dobbeltklik aldrig anvender værdier to gange.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return NextResponse.json({ message: "Ugyldig afgørelse" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.productNutritionReport.findUnique({ where: { id } });
    if (!report) return { status: 404 as const };

    const claimed = await tx.productNutritionReport.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count === 0) return { status: 409 as const };

    if (decision === "APPROVE") {
      const changes = parseNutritionReportChanges(report.changes);
      if (changes.length > 0) {
        await tx.product.update({
          where: { id: report.productId },
          data: Object.fromEntries(changes.map((change) => [change.field, change.reported])),
        });
      }
    }
    return { status: 200 as const };
  });

  if (result.status === 404) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (result.status === 409) return NextResponse.json({ message: "Allerede afgjort" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
