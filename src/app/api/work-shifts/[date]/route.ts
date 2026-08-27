import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

// :date er "YYYY-MM-DD".

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  try {
    const user = await getDemoUser();
    const shift = await prisma.workShift.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(date) } },
    });

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Work shift fetch failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PUT — upsert dagens arbejdstid/søvn-override. Ingen "Gem"-knap-princip.
export async function PUT(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const body = await req.json();
  const { startTime, endTime, bedtime, wakeTime } = body as {
    startTime?: string | null;
    endTime?: string | null;
    bedtime?: string | null;
    wakeTime?: string | null;
  };

  try {
    const user = await getDemoUser();
    const shift = await prisma.workShift.upsert({
      where: { userId_date: { userId: user.id, date: new Date(date) } },
      update: { startTime, endTime, bedtime, wakeTime },
      create: {
        userId: user.id,
        date: new Date(date),
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        bedtime: bedtime ?? null,
        wakeTime: wakeTime ?? null,
      },
    });

    return NextResponse.json({ shift });
  } catch (error) {
    console.error("Work shift update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  try {
    const user = await getDemoUser();
    await prisma.workShift.deleteMany({
      where: { userId: user.id, date: new Date(date) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Work shift delete failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
