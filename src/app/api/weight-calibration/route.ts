import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";

// GET — er vægten kalibreret? POST — markér den som kalibreret.
export async function GET() {
  try {
    const user = await getProfileUser("weight", "VIEWED");
    if (!user) return unauthorized();
    return NextResponse.json({ calibrated: Boolean(user.weightCalibratedAt) });
  } catch {
    return NextResponse.json({ calibrated: true });
  }
}

export async function POST() {
  try {
    const user = await getProfileUser("weight", "UPDATED");
    if (!user) return unauthorized();
    await prisma.user.update({ where: { id: user.id }, data: { weightCalibratedAt: new Date() } });
    return NextResponse.json({ calibrated: true });
  } catch (error) {
    console.error("Weight calibration mark failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
