import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { findCurrentSupportGrant, parseSupportGrantInput, serializeSupportGrant } from "@/lib/support-access";

// Indstillinger → Support (docs/DECISIONS.md 2026-09-23): the signed-in
// user's own time-limited Support permission. Only the owner can read or
// change it; there is no admin override.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se din supporttilladelse" }, { status: 401 });

  const grant = await findCurrentSupportGrant(user.id);
  return NextResponse.json({ grant: grant ? serializeSupportGrant(grant) : null });
}

// Replaces the current grant: the old one is revoked (kept as history) and a
// new one is created, so a grant's period/categories never change after the
// fact.
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at give Support adgang" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseSupportGrantInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, detail: parsed.detail ?? null }, { status: 400 });
  }

  const now = new Date();
  const [, grant] = await prisma.$transaction([
    prisma.supportAccessGrant.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.supportAccessGrant.create({
      data: {
        userId: user.id,
        validFrom: parsed.validFrom,
        validUntil: parsed.validUntil,
        permissions: parsed.permissions as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  return NextResponse.json({ grant: serializeSupportGrant(grant) });
}

// Revokes (never deletes) every not-yet-revoked grant.
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at tilbagekalde Support-adgang" }, { status: 401 });

  await prisma.supportAccessGrant.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ grant: null });
}
