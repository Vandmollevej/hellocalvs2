import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { hashEmail, normalizeEmail } from "@/lib/email-hash";
import { APPROVAL_TTL_MS, sameHash } from "@/lib/recovery";

// Admin: gendannelsessager (docs/PRIVACY.md "Gendannelse"). Support ser kun
// sagsnummer og tidspunkter — aldrig brugerens data. Identiteten bekræftes
// ved personlig henvendelse: brugeren oplyser sagsnummer og e-mail, og
// support kan tjekke, at e-mailen passer til sagen, uden at den gemmes.

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const requests = await prisma.recoveryRequest.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] }, expiresAt: { gt: new Date() } },
    select: { id: true, caseCode: true, status: true, createdAt: true, expiresAt: true, approvedAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ requests });
}

// POST { id, action: "check-email", email } → { matches }
// POST { id, action: "approve" | "reject" }
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const request = id
    ? await prisma.recoveryRequest.findUnique({ where: { id }, include: { user: { select: { emailHash: true } } } })
    : null;
  if (!request) return NextResponse.json({ message: "Ukendt sag" }, { status: 404 });

  if (body?.action === "check-email") {
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const matches = Boolean(email && request.user.emailHash && sameHash(hashEmail(email), request.user.emailHash));
    return NextResponse.json({ matches });
  }

  if (request.status !== "PENDING" || request.expiresAt < new Date()) {
    return NextResponse.json({ message: "Sagen er ikke åben" }, { status: 409 });
  }
  if (body?.action === "approve") {
    await prisma.recoveryRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: admin.id,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      },
    });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "reject") {
    await prisma.recoveryRequest.update({ where: { id }, data: { status: "REJECTED" } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
}
