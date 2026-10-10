import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { BODY_MEASUREMENT_FIELDS, type BodyMeasurementField } from "@/lib/body-measurements";

export async function GET() {
  try {
    const user = await getProfileUser("bodyMeasurements", "VIEWED");

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
  const body = (await req.json()) as Partial<Record<BodyMeasurementField | "neckCm", number | null>> & {
    note?: string;
    // Same backdating pattern as WeightEntry.weighedAt.
    measuredAt?: string;
  };
  const { note, measuredAt } = body;

  // Kun kendte mål tages med (neckCm findes stadig i databasen, men vises ikke).
  const values: Record<string, number | null> = {};
  for (const { field } of BODY_MEASUREMENT_FIELDS) values[field] = body[field] ?? null;
  values.neckCm = body.neckCm ?? null;

  if (!Object.values(values).some(Boolean)) {
    return NextResponse.json(
      { message: "Mindst ét kropsmål er påkrævet" },
      { status: 400 }
    );
  }

  const parsedMeasuredAt = measuredAt ? new Date(measuredAt) : undefined;
  if (parsedMeasuredAt && Number.isNaN(parsedMeasuredAt.getTime())) {
    return NextResponse.json({ message: "measuredAt er ugyldig" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("bodyMeasurements", "CREATED");

    if (!user) return unauthorized();
    const entry = await prisma.bodyMeasurement.create({
      data: {
        userId: user.id,
        ...values,
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
