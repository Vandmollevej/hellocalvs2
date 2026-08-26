import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getDemoUser();
    const registration = await prisma.registration.findFirst({
      where: { id, userId: user.id },
      include: { product: { select: { imageUrl: true } } },
    });

    if (!registration) {
      return NextResponse.json({ registration: null }, { status: 404 });
    }

    return NextResponse.json({ registration });
  } catch (error) {
    console.error("Registration fetch failed", error);
    return NextResponse.json(
      { registration: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const user = await getDemoUser();
    const result = await prisma.registration.deleteMany({
      where: { id, userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Registreringen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Registration delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
