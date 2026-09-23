import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isSupportGrantActive } from "@/lib/support-access";
import { isBase64Url } from "@/lib/vault/server";

// POST { grantId, keyId, epk, iv, ciphertext } — brugerens enhed lægger en
// forseglet pakke med de data, brugeren har givet Support lov til at se
// (docs/PRIVACY.md "Support"). Serveren kan ikke åbne den. Erstatter en
// tidligere pakke for samme tilladelse.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    typeof body?.grantId !== "string" ||
    typeof body?.keyId !== "string" ||
    !isBase64Url(body?.epk, 64) ||
    !isBase64Url(body?.iv, 32) ||
    !isBase64Url(body?.ciphertext, 8 * 1024 * 1024)
  ) {
    return NextResponse.json({ message: "Ugyldig pakke" }, { status: 400 });
  }
  const grant = await prisma.supportAccessGrant.findFirst({ where: { id: body.grantId, userId: user.id } });
  if (!grant || grant.revokedAt || grant.validUntil < new Date()) {
    return NextResponse.json({ message: "Tilladelsen er ikke aktiv" }, { status: 409 });
  }
  const key = await prisma.supportKey.findFirst({ where: { id: body.keyId, active: true }, select: { id: true } });
  if (!key) return NextResponse.json({ message: "Supportnøglen er udskiftet" }, { status: 409 });

  const data = { keyId: key.id, epk: body.epk as string, iv: body.iv as string, ciphertext: body.ciphertext as string };
  await prisma.supportPackage.upsert({ where: { grantId: grant.id }, create: { grantId: grant.id, ...data }, update: data });
  return NextResponse.json({ ok: true, active: isSupportGrantActive(grant) });
}
