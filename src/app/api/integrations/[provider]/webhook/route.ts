import { after, NextResponse, type NextRequest } from "next/server";
import { handleGarminNotification, type GarminNotification } from "@/lib/integrations/garmin-webhook";

// POST /api/integrations/garmin/webhook[?key=<GARMIN_WEBHOOK_KEY>]
// Adressen registreres i Garmins Developer Portal som ping-adresse for alle
// datatyper og for "Deregistration". Garmin skal have svar inden for 30
// sekunder, så dataene hentes efter svaret.
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  if ((await ctx.params).provider !== "garmin") return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });
  const key = process.env.GARMIN_WEBHOOK_KEY;
  if (key && req.nextUrl.searchParams.get("key") !== key) return NextResponse.json({ message: "Forkert nøgle" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as GarminNotification | null;
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Ugyldig notifikation" }, { status: 400 });
  after(() => handleGarminNotification(body).catch((error) => console.error("Garmin ping fejlede", error)));
  return NextResponse.json({ ok: true });
}
