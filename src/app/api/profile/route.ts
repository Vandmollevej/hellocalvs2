import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { SERVER_PROFILE_FIELDS } from "@/lib/profile-fields";

// Serverdelen af profilen (docs/PRIVACY.md). Navn, vægt, højde,
// fødselsdato, køn, cyklus, søvn, allergener m.m. ligger krypteret i
// brugerens boks og håndteres på enheden (src/lib/vault/handlers/profile.ts).
// Serveren kender kun SERVER_PROFILE_FIELDS.

const SELECT = {
  id: true,
  role: true,
  createdAt: true,
  referralCode: true,
  freeMonthsCredited: true,
  ...Object.fromEntries(SERVER_PROFILE_FIELDS.map((f) => [f, true])),
} as const;

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: SELECT });
  return NextResponse.json({ user });
}

// PATCH — kun serverfelterne. Gemmes løbende (ingen "Gem"-knap).
export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.region === "string" && /^[A-Z]{2}$/.test(body.region)) data.region = body.region;
  if (body.appLocale === "da" || body.appLocale === "en") data.appLocale = body.appLocale;
  for (const key of SERVER_PROFILE_FIELDS.slice(2)) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  const user = await prisma.user.update({ where: { id: session.id }, data, select: SELECT });
  return NextResponse.json({ user });
}
