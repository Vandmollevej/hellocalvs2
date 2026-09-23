import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// GET — Supports aktive offentlige nøgle, som brugerens enhed forsegler
// supportpakken til (docs/PRIVACY.md "Support").
export async function GET() {
  if (!(await getSessionUser())) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const key = await prisma.supportKey.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicKey: true },
  });
  return NextResponse.json({ key });
}
