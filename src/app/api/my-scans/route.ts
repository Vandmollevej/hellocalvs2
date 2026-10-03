import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileContext } from "@/lib/family-access";
import { listUserScans } from "@/lib/user-scans";

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
