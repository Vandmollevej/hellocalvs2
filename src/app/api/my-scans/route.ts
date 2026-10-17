import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileContext } from "@/lib/family-access";
import { hideUserScan, listUserScans, recordProductScanSafely } from "@/lib/user-scans";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Brugerens egne indscanninger (src/lib/user-scans.ts). Varerne følger den,
// der holdt telefonen; "tilføjet" tæller også den aktive familieprofil.
export async function GET() {
  try {
    const context = await getProfileContext("registrations", "VIEWED");
    if (!context) return unauthorized();
    const scans = await listUserScans(context.login.id, context.profile.id);
    return NextResponse.json({ scans });
  } catch (error) {
    console.error("GET /api/my-scans failed", error);
    return NextResponse.json({ error: "Kunne ikke hente indscanninger" }, { status: 500 });
  }
}

// Swipe → Slet: skjuler varen fra listen, indtil den scannes igen.
export async function DELETE(request: Request) {
  try {
    const context = await getProfileContext("registrations", "VIEWED");
    if (!context) return unauthorized();
    const productId = new URL(request.url).searchParams.get("productId");
    if (!productId) return NextResponse.json({ error: "productId mangler" }, { status: 400 });
    await hideUserScan(context.login.id, productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/my-scans failed", error);
    return NextResponse.json({ error: "Kunne ikke slette indscanningen" }, { status: 500 });
  }
}

// Kameraflowet fandt en eksisterende vare ud fra forsiden (dublet) og går til
// den uden stregkodeopslag — scanningen gemmes her, så varen kommer på listen.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const product = productId ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }) : null;
  if (!product) return NextResponse.json({ error: "Ukendt vare" }, { status: 404 });
  await recordProductScanSafely(user.id, product.id);
  return NextResponse.json({ ok: true });
}
