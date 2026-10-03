import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { getPublicVapidKey } from "@/lib/push";

// Web Push-abonnement for den indloggede brugers enhed. GET giver den
// offentlige VAPID-nøgle (null = push er ikke sat op på serveren).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const count = await prisma.pushSubscription.count({ where: { userId: user.id } });
  return NextResponse.json({
    publicKey: getPublicVapidKey(),
    subscriptions: count,
    loginApprovalEnabled: user.loginApprovalEnabled,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const { endpoint, keys } = body;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string"
  ) {
    return NextResponse.json({ message: "Ugyldigt abonnement" }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ success: true }, { status: 201 });
}
