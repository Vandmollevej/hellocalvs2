import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const schedules = await prisma.sleepSchedule.findMany({
      where: { userId: user.id },
      orderBy: { weekday: "asc" },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("Sleep schedule list failed", error);
    return NextResponse.json(
      { schedules: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PUT /api/sleep-schedule — upserts (or deletes, if both times are missing)
// the times for one weekday at a time, per the UI principle of no "Save" button.
export async function PUT(req: Request) {
  const body = await req.json();
  const { weekday, bedtime, wakeTime } = body as {
    weekday: number;
    bedtime: string | null;
    wakeTime: string | null;
  };

  if (weekday === undefined || weekday < 0 || weekday > 6) {
    return NextResponse.json({ message: "weekday (0-6) er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();

    if (!bedtime && !wakeTime) {
      await prisma.sleepSchedule.deleteMany({ where: { userId: user.id, weekday } });
      return NextResponse.json({ schedule: null });
    }

    const schedule = await prisma.sleepSchedule.upsert({
      where: { userId_weekday: { userId: user.id, weekday } },
      update: { bedtime: bedtime ?? "", wakeTime: wakeTime ?? "" },
      create: { userId: user.id, weekday, bedtime: bedtime ?? "", wakeTime: wakeTime ?? "" },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Sleep schedule update failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
