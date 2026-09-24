import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// POST — anonym brug af en delt ret (favorit eller kopi), til sortering
// efter popularitet. Ingen bruger gemmes (docs/PRIVACY.md "Statistik").
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionUser())) return new NextResponse(null, { status: 204 });
  const { id } = await params;
  await prisma.sharedRecipe
    .updateMany({ where: { id }, data: { popularity: { increment: 1 } } })
    .catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
