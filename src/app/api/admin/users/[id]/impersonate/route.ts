import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { signImpersonationHandoff } from "@/lib/user-auth";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

// "Log ind som bruger" (docs/DECISIONS.md 2026-09-02): logges i
// AdminAuditLog. Returnerer et 2-minutters engangs-link til bruger-domænet,
// som selv veksler det til en rigtig session — se
// src/app/api/auth/impersonate/route.ts.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.forgottenAt) {
    return NextResponse.json({ message: "Brugeren findes ikke" }, { status: 404 });
  }

  await prisma.adminAuditLog.create({
    data: { adminId: admin.id, action: "IMPERSONATE_USER", targetUserId: target.id },
  });

  const handoff = await signImpersonationHandoff(target.id, admin.id);
  return NextResponse.json({ url: `${APP_BASE_URL}/api/auth/impersonate?token=${handoff}` });
}
