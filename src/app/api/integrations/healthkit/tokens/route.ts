import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { generateDeviceToken } from "@/lib/device-tokens";

export async function GET() {
  try {
    const user = await getDemoUser();
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, createdAt: true, lastUsedAt: true },
    });
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Device token list failed", error);
    return NextResponse.json({ tokens: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// POST /api/integrations/healthkit/tokens — opretter et nyt enhedstoken til
// en fremtidig HealthKit/Health Connect-companion-app (docs/HEALTHKIT_COMPANION.md).
// Den rå token-værdi returneres kun her, én gang.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Companion-app";

  try {
    const user = await getDemoUser();
    const { raw, hash } = generateDeviceToken();
    const token = await prisma.deviceToken.create({
      data: { userId: user.id, tokenHash: hash, label },
    });
    return NextResponse.json({ token: raw, id: token.id, label: token.label });
  } catch (error) {
    console.error("Device token create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
