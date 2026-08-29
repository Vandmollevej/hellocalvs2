import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const entries = await prisma.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { weighedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Weight entry list failed", error);
    return NextResponse.json(
      { entries: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { weightKg, clothed, shoes, toilet, meal, timeOfDay, note } = body as {
    weightKg: number;
    clothed: boolean;
    shoes?: "ON" | "OFF" | "UNKNOWN";
    toilet: "BEFORE" | "AFTER" | "UNKNOWN";
    meal: "BEFORE" | "AFTER" | "UNKNOWN";
    timeOfDay: "MORNING" | "EVENING" | "UNKNOWN";
    note?: string;
  };

  if (!weightKg || weightKg <= 0) {
    return NextResponse.json({ message: "weightKg (> 0) er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const entry = await prisma.weightEntry.create({
      data: {
        userId: user.id,
        weightKg,
        clothed: clothed ?? true,
        shoes: shoes ?? "UNKNOWN",
        toilet: toilet ?? "UNKNOWN",
        meal: meal ?? "UNKNOWN",
        timeOfDay: timeOfDay ?? "UNKNOWN",
        note: note || null,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Weight entry create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
