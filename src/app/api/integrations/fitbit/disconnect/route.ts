import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function POST() {
  try {
    const user = await getDemoUser();
    await prisma.integration.updateMany({
      where: { userId: user.id, provider: "FITBIT" },
      data: {
        status: "DISCONNECTED",
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        lastError: null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Fitbit disconnect failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
