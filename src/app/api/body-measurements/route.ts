import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    const entries = await prisma.bodyMeasurement.findMany({
      where: { userId: user.id },
      orderBy: { measuredAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Body measurement list failed", error);
    return NextResponse.json(
      { entries: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { waistCm, hipCm, chestCm, thighCm, upperArmCm, neckCm, note, measuredAt } = body as {
    waistCm?: number | null;
    hipCm?: number | null;
    chestCm?: number | null;
    thighCm?: number | null;
    upperArmCm?: number | null;
    neckCm?: number | null;
    note?: string;
    // Same backdating pattern as WeightEntry.weighedAt.
    measuredAt?: string;
  };

  if (!waistCm && !hipCm && !chestCm && !thighCm && !upperArmCm && !neckCm) {
    return NextResponse.json(
      { message: "Mindst ét mål (hals, talje, hofte, bryst, lår eller overarm) er påkrævet" },
      { status: 400 }
    );
  }

  const parsedMeasuredAt = measuredAt ? new Date(measuredAt) : undefined;
  if (parsedMeasuredAt && Number.isNaN(parsedMeasuredAt.getTime())) {
    return NextResponse.json({ message: "measuredAt er ugyldig" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    const entry = await prisma.bodyMeasurement.create({
      data: {
        userId: user.id,
        waistCm: waistCm ?? null,
        hipCm: hipCm ?? null,
        chestCm: chestCm ?? null,
        thighCm: thighCm ?? null,
        upperArmCm: upperArmCm ?? null,
        neckCm: neckCm ?? null,
        note: note || null,
        ...(parsedMeasuredAt ? { measuredAt: parsedMeasuredAt } : {}),
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Body measurement create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
