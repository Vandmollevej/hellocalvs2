import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/admin-access";

// Login-frit mail-link (middleware.ts PUBLIC_ADMIN_API_PATHS): sikkerheden er
// det uigættelige token. Godkendelsen kræver et aktivt klik (POST), så
// mail-scannere, der åbner linket, ikke godkender ved en fejl.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // tom krop tolkes som godkend
  }
  const decision = body.decision === "deny" ? "deny" : "approve";

  const approval = await prisma.adminLoginApproval.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!approval || approval.consumedAt || approval.expiresAt < new Date()) {
    return NextResponse.json({ message: "Linket er ikke gyldigt, er udløbet eller allerede brugt." }, { status: 410 });
  }
  if (decision === "deny") {
    await prisma.adminLoginApproval.delete({ where: { id: approval.id } });
    return NextResponse.json({ ok: true, decision });
  }
  await prisma.adminLoginApproval.update({ where: { id: approval.id }, data: { approvedAt: new Date() } });
  return NextResponse.json({ ok: true, decision });
}
