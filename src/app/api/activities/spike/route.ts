import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { changePulseSport, getPulseEvents, recordPulseAnswer } from "@/lib/pulse-candidates";

// GET: næste "Vi kan se, at din puls var højere end sædvanlig …"-spørgsmål
// (nattens puls-robot + friske udsving), eller { spike: null }.
// `remaining` er antal ubesvarede, der venter efter dette.
export async function GET() {
  const user = await getProfileUser("activities", "VIEWED");
  if (!user) return unauthorized();
  try {
    // `events`: alle ubesvarede de seneste 7 dage (ældste først), så arket kan bladre frem og tilbage.
    const events = await getPulseEvents(user.id, { pendingOnly: true, sync: true });
    return NextResponse.json({ spike: events[events.length - 1] ?? null, remaining: Math.max(0, events.length - 1), events });
  } catch (error) {
    console.error("Heart rate spike lookup failed", error);
    return NextResponse.json({ spike: null, remaining: 0 });
  }
}

// POST { startedAt, endedAt, extraKcal, activityId? }: udsvinget er besvaret
// (med en aktivitet) eller sprunget over (uden). Spørges ikke igen. Svaret
// gemmes også på robottens fund, så den lærer af det.
export async function POST(req: Request) {
  const user = await getProfileUser("activities", "CREATED");
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    startedAt?: string;
    endedAt?: string;
    extraKcal?: number;
    activityId?: string;
    changeSport?: { activityId?: string; sportType?: string };
  };
  // Skift af træningstype på et allerede besvaret udsving (kalenderen).
  if (body.changeSport?.activityId && body.changeSport.sportType) {
    const ok = await changePulseSport(user.id, body.changeSport.activityId, body.changeSport.sportType);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ message: "Aktivitet findes ikke" }, { status: 404 });
  }
  const startedAt = new Date(body.startedAt ?? "");
  const endedAt = new Date(body.endedAt ?? "");
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldigt tidsrum" }, { status: 400 });
  }
  await recordPulseAnswer(user.id, {
    startedAt,
    endedAt,
    extraKcal: Number(body.extraKcal) || 0,
    activityId: body.activityId ?? null,
  });
  return NextResponse.json({ ok: true });
}
