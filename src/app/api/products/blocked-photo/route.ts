import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";
import { attachPetFoodIncidentPhoto } from "@/lib/pet-food-strikes";

// POST /api/products/blocked-photo — kameraflowet sender billedet af den spærrede scanning (dyrefoder)
// kort efter, at opslaget blev afvist, så admin kan se, hvad brugeren forsøgte at oprette
// (docs/DECISIONS.md 2026-10-07). Sessionen læses direkte: en lige spærret konto er ikke længere
// "logget ind" (src/lib/session.ts), men er stadig den, der ejer hændelsen.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { incidentId?: unknown; photo?: unknown } | null;
  if (typeof body?.incidentId !== "string" || typeof body.photo !== "string" || body.photo.length > 8_000_000) {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const token = (await cookies()).get(USER_SESSION_COOKIE)?.value;
  const session = token ? await verifyUserSession(token) : null;
  const ok = await attachPetFoodIncidentPhoto(body.incidentId, session?.userId ?? null, body.photo);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
