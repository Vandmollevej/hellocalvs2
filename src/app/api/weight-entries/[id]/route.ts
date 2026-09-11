import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const { weightKg } = (await req.json()) as { weightKg: number };

  if (!weightKg || weightKg <= 0) {
    return NextResponse.json({ message: "weightKg (> 0) er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const result = await prisma.weightEntry.updateMany({
      where: { id, userId: user.id },
      data: { weightKg },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Vejningen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Weight entry update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getDemoUser();
    const result = await prisma.weightEntry.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Vejningen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Weight entry delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
