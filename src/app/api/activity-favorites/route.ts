import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";

// Favorit-aktiviteter: nøglerne (SPORT_TYPES-nøgle eller navn på en egen
// aktivitet) vises øverst i aktivitetssøgningen.
export async function GET() {
  const user = await getProfileUser("activities", "VIEWED");
  if (!user) return unauthorized();
  const rows = await prisma.activityFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { sportKey: true },
  });
  return NextResponse.json({ keys: rows.map((row) => row.sportKey) });
}

async function keyFrom(req: Request) {
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key.trim().slice(0, 60) : "";
  return key || null;
}

export async function POST(req: Request) {
  const user = await getProfileUser("activities", "CREATED");
  if (!user) return unauthorized();
  const key = await keyFrom(req);
  if (!key) return NextResponse.json({ message: "key mangler" }, { status: 400 });
  await prisma.activityFavorite.upsert({
    where: { userId_sportKey: { userId: user.id, sportKey: key } },
    create: { userId: user.id, sportKey: key },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getProfileUser("activities", "DELETED");
  if (!user) return unauthorized();
  const key = await keyFrom(req);
  if (!key) return NextResponse.json({ message: "key mangler" }, { status: 400 });
  await prisma.activityFavorite.deleteMany({ where: { userId: user.id, sportKey: key } });
  return NextResponse.json({ ok: true });
}
