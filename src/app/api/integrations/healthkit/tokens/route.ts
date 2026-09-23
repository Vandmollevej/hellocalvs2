import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { generateDeviceToken } from "@/lib/device-tokens";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
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

// POST /api/integrations/healthkit/tokens — creates a new device token for
// a future HealthKit/Health Connect companion app (docs/HEALTHKIT_COMPANION.md).
// The raw token value is only returned here, once.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Companion-app";
  // docs/PRIVACY.md: indsendte data forsegles til brugerens anonyme indbakke.
  const inboxId = typeof body.inboxId === "string" ? body.inboxId : null;
  if (!inboxId || !(await prisma.vaultInbox.findUnique({ where: { id: inboxId }, select: { id: true } }))) {
    return NextResponse.json({ message: "inboxId mangler" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ message: "Log ind først" }, { status: 401 });
    const { raw, hash } = generateDeviceToken();
    const token = await prisma.deviceToken.create({
      data: { userId: user.id, tokenHash: hash, label, inboxId },
    });
    return NextResponse.json({ token: raw, id: token.id, label: token.label });
  } catch (error) {
    console.error("Device token create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
