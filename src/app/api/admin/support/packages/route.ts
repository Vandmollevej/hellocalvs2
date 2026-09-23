import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isSupportGrantActive } from "@/lib/support-access";

// GET ?grantId=… — den forseglede pakke for en aktiv tilladelse
// (docs/PRIVACY.md "Support"). Kun inden for adgangsperioden; pakken åbnes
// i admins browser med Supports private nøgle.
export async function GET(req: Request) {
  if (!(await requireAdminUser())) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const grantId = new URL(req.url).searchParams.get("grantId") ?? "";
  const grant = await prisma.supportAccessGrant.findUnique({ where: { id: grantId }, include: { packages: true } });
  if (!grant || !isSupportGrantActive(grant)) {
    return NextResponse.json({ message: "Tilladelsen er ikke aktiv" }, { status: 403 });
  }
  const pkg = grant.packages[0];
  if (!pkg) return NextResponse.json({ package: null });
  return NextResponse.json({
    package: { keyId: pkg.keyId, epk: pkg.epk, iv: pkg.iv, ciphertext: pkg.ciphertext, createdAt: pkg.createdAt },
  });
}
