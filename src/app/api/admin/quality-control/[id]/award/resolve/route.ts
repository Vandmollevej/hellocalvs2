import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { awardPoints } from "@/lib/points";

// Godkender eller afviser et brugerindsendt erstatningsbillede
// (docs/DECISIONS.md, 2026-09-19). Billedet erstatter IKKE automatisk det
// gamle ved indsendelse — kun her, ved admin-godkendelse, opdateres
// AiProductAnalysis.imageUrl (den reference fremtidige match-checks
// sammenlignes mod), og først her udbetales points via den eksisterende
// points-ledger (src/lib/points.ts). Ved afvisning nulstilles Awarden til
// OPEN, så brugeren (eller en anden) kan indsende et nyt billede.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const approve = Boolean(body?.approve);

  const award = await prisma.productPhotoAward.findUnique({
    where: { matchCheckId: id },
    include: { matchCheck: { select: { analysisId: true } } },
  });
  if (!award || award.status !== "SUBMITTED") {
    return NextResponse.json({ message: "Ingen indsendelse afventer gennemgang" }, { status: 400 });
  }

  if (!approve) {
    const rejected = await prisma.productPhotoAward.update({
      where: { id: award.id },
      data: { status: "OPEN", submittedImageUrl: null, submittedByUserId: null, submittedAt: null },
    });
    return NextResponse.json({ award: rejected });
  }

  const [updatedAward] = await prisma.$transaction([
    prisma.productPhotoAward.update({
      where: { id: award.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
    prisma.aiProductAnalysis.update({
      where: { id: award.matchCheck.analysisId },
      data: { imageUrl: award.submittedImageUrl },
    }),
  ]);

  if (award.submittedByUserId) {
    await awardPoints(award.submittedByUserId, "QUALITY_CONTROL_PHOTO", award.points, {
      productId: award.productId,
    });
  }

  return NextResponse.json({ award: updatedAward });
}
