import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isQualityControlPhotoType } from "@/lib/quality-control-photo-types";

// Award-toggle for en ProductMatchCheck-problemstilling (docs/DECISIONS.md,
// 2026-09-19). Admin sætter selv antal points pr. Award (ingen fast sats,
// eksplicit brugervalg). Upsert, så den samme match-check kan slås til/fra
// eller have sine points justeret uden at oprette dubletter.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const points = Number(body?.points);
  if (enabled && (!Number.isFinite(points) || points <= 0)) {
    return NextResponse.json({ message: "Points skal være et positivt tal" }, { status: 400 });
  }

  const matchCheck = await prisma.productMatchCheck.findUnique({
    where: { id },
    select: { productId: true, photoType: true },
  });
  if (!matchCheck) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (!isQualityControlPhotoType(matchCheck.photoType)) {
    return NextResponse.json({ message: "Billedtypen kan ikke bruges til en Award" }, { status: 400 });
  }

  const award = await prisma.productPhotoAward.upsert({
    where: { matchCheckId: id },
    create: {
      matchCheckId: id,
      productId: matchCheck.productId,
      photoType: matchCheck.photoType,
      points: Number.isFinite(points) ? points : 0,
      enabled,
    },
    update: {
      enabled,
      ...(Number.isFinite(points) ? { points } : {}),
    },
  });
  return NextResponse.json({ award });
}
