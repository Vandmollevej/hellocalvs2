import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isBase64Url } from "@/lib/vault/server";

// Supports nøglepar (docs/PRIVACY.md "Support"). Laves i admins browser;
// kun den offentlige nøgle sendes hertil. En ny nøgle erstatter den gamle,
// og pakker forseglet til den gamle nøgle kan så kun åbnes med den gamle
// private nøgle (admins backupfil).
export async function GET() {
  if (!(await requireAdminUser())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const key = await prisma.supportKey.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicKey: true, createdAt: true },
  });
  return NextResponse.json({ key });
}

export async function POST(req: Request) {
  if (!(await requireAdminUser())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { publicKey?: unknown } | null;
  if (!isBase64Url(body?.publicKey, 64)) return NextResponse.json({ message: "Ugyldig nøgle" }, { status: 400 });
  const [, key] = await prisma.$transaction([
    prisma.supportKey.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.supportKey.create({ data: { publicKey: body!.publicKey as string }, select: { id: true, publicKey: true } }),
  ]);
  return NextResponse.json({ key });
}
