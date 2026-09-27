import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const { waistCm, hipCm, chestCm, thighCm, upperArmCm, neckCm, note } = (await req.json()) as {
    waistCm?: number | null;
    hipCm?: number | null;
    chestCm?: number | null;
    thighCm?: number | null;
    upperArmCm?: number | null;
    neckCm?: number | null;
    note?: string | null;
  };

  try {
    const user = await getSessionUser();

    if (!user) return unauthorized();
    const result = await prisma.bodyMeasurement.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(waistCm !== undefined ? { waistCm } : {}),
        ...(hipCm !== undefined ? { hipCm } : {}),
        ...(chestCm !== undefined ? { chestCm } : {}),
        ...(thighCm !== undefined ? { thighCm } : {}),
        ...(upperArmCm !== undefined ? { upperArmCm } : {}),
        ...(neckCm !== undefined ? { neckCm } : {}),
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
    const user = await getSessionUser();

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
