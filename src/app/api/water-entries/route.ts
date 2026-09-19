import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const entries = await prisma.waterEntry.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Water entry list failed", error);
    return NextResponse.json(
      { entries: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { amountMl, loggedAt } = body as {
    amountMl: number;
    // Same backdating pattern as WeightEntry.weighedAt.
    loggedAt?: string;
  };

  if (!amountMl || amountMl <= 0) {
    return NextResponse.json({ message: "amountMl (> 0) er påkrævet" }, { status: 400 });
  }

  const parsedLoggedAt = loggedAt ? new Date(loggedAt) : undefined;
  if (parsedLoggedAt && Number.isNaN(parsedLoggedAt.getTime())) {
    return NextResponse.json({ message: "loggedAt er ugyldig" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const entry = await prisma.waterEntry.create({
      data: {
        userId: user.id,
        amountMl,
        ...(parsedLoggedAt ? { loggedAt: parsedLoggedAt } : {}),
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Water entry create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
