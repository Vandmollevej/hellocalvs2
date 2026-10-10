import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { BODY_MEASUREMENT_FIELDS, type BodyMeasurementField } from "@/lib/body-measurements";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Record<BodyMeasurementField | "neckCm", number | null>> & {
    note?: string | null;
  };
  const { note } = body;
  const values: Record<string, number | null> = {};
  for (const field of [...BODY_MEASUREMENT_FIELDS.map((def) => def.field), "neckCm" as const]) {
    if (body[field] !== undefined) values[field] = body[field] ?? null;
  }

  try {
    const user = await getProfileUser("bodyMeasurements", "UPDATED");

    if (!user) return unauthorized();
    const result = await prisma.bodyMeasurement.updateMany({
      where: { id, userId: user.id },
      data: {
        ...values,
        ...(note !== undefined ? { note: note || null } : {}),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Målingen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Body measurement update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getProfileUser("bodyMeasurements", "DELETED");

    if (!user) return unauthorized();
    const result = await prisma.bodyMeasurement.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Målingen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Body measurement delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
