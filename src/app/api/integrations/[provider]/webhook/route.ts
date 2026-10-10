import { after, NextResponse, type NextRequest } from "next/server";
import { handleGarminNotification, type GarminNotification } from "@/lib/integrations/garmin-webhook";
import { handleWithingsNotification } from "@/lib/integrations/withings-webhook";

// POST /api/integrations/garmin/webhook[?key=<GARMIN_WEBHOOK_KEY>]
// Adressen registreres i Garmins Developer Portal som ping-adresse for alle
// datatyper og for "Deregistration". Garmin skal have svar inden for 30
// sekunder, så dataene hentes efter svaret.
//
// POST /api/integrations/withings/webhook
// Tilmeldes automatisk pr. bruger (src/lib/integrations/withings.ts). Withings
// sender userid/appli som formular og skal have svar inden for 2 sekunder.
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const provider = (await ctx.params).provider;
  if (provider === "withings") {
    const form = await req.formData().catch(() => null);
    const userId = form?.get("userid");
    if (typeof userId !== "string" || !userId) return NextResponse.json({ message: "Ugyldig notifikation" }, { status: 400 });
    after(() => handleWithingsNotification(userId).catch((error) => console.error("Withings notifikation fejlede", error)));
    return NextResponse.json({ ok: true });
  }
  if (provider !== "garmin") return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });
  const key = process.env.GARMIN_WEBHOOK_KEY;
  if (key && req.nextUrl.searchParams.get("key") !== key) return NextResponse.json({ message: "Forkert nøgle" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as GarminNotification | null;
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Ugyldig notifikation" }, { status: 400 });
  after(() => handleGarminNotification(body).catch((error) => console.error("Garmin ping fejlede", error)));
  return NextResponse.json({ ok: true });
}

// Withings tjekker adressen med HEAD/GET, når notifikationer tilmeldes.
function probe(provider: string) {
  return new NextResponse(null, { status: provider === "withings" ? 200 : 404 });
}

export async function HEAD(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return probe((await ctx.params).provider);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return probe((await ctx.params).provider);
}
