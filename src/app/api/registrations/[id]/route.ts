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

// PATCH /api/registrations/[id] — flytter en registrering til et nyt
// tidspunkt (samme dato, nyt klokkeslæt). Bruges af kalenderens
// hold-og-træk-gestus (src/app/kalender/page.tsx, DraggableEntryMarker).
// Snapshot-felterne (kcal/protein/osv.) ændres aldrig her.
export async function PATCH(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const body = await req.json();
  const { createdAt } = body as { createdAt?: string };

  if (!createdAt) {
    return NextResponse.json({ message: "createdAt er påkrævet" }, { status: 400 });
  }
  const parsedCreatedAt = new Date(createdAt);
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldig createdAt" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const result = await prisma.registration.updateMany({
      where: { id, userId: user.id },
      data: { createdAt: parsedCreatedAt },
    });

    if (result.count === 0) {
      return NextResponse.json({ message: "Registreringen findes ikke" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Registration update failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
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
