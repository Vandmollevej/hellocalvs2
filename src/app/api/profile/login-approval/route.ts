import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Slå login-godkendelse til/fra. Kan kun slås til, når mindst én enhed har et
// push-abonnement — ellers kunne brugeren låse sig selv ude.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (body.enabled) {
    const subscriptions = await prisma.pushSubscription.count({ where: { userId: user.id } });
    if (subscriptions === 0) {
      return NextResponse.json({ message: "Slå først notifikationer til på denne enhed." }, { status: 400 });
    }
  }
  await prisma.user.update({ where: { id: user.id }, data: { loginApprovalEnabled: body.enabled } });
  return NextResponse.json({ enabled: body.enabled });
}
