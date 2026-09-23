import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// POST { productId } — en registrering af produktet i dag, uden bruger
// (docs/PRIVACY.md "Statistik"). Bruges af Kvalitetskontrol som
// popularitetsmål i stedet for at læse brugernes registreringer.
export async function POST(req: Request) {
  if (!(await getSessionUser())) return new NextResponse(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : null;
  if (!productId) return NextResponse.json({ message: "productId mangler" }, { status: 400 });
  const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!exists) return new NextResponse(null, { status: 204 });
  const day = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  await prisma.productUsageDaily.upsert({
    where: { day_productId: { day, productId } },
    create: { day, productId, count: 1 },
    update: { count: { increment: 1 } },
  });
  return new NextResponse(null, { status: 204 });
}
