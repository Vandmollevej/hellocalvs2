import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
    await prisma.integration.updateMany({
      where: { userId: user.id, provider: "WITHINGS" },
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
    console.error("Withings disconnect failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
