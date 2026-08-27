import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const shifts = await prisma.workShift.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ shifts });
  } catch (error) {
    console.error("Work shift list failed", error);
    return NextResponse.json(
      { shifts: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
