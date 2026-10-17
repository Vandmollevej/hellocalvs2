import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileContext } from "@/lib/family-access";
import { hideUserScan, listUserScans } from "@/lib/user-scans";

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
