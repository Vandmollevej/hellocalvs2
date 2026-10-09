import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { getPulseEvents } from "@/lib/pulse-candidates";

// GET: alle pulsudsving de seneste 7 dage (ubesvarede og besvarede, ældste
// først) til kalenderens røde hjerter.
export async function GET() {
  const user = await getProfileUser("activities", "VIEWED");
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ events: await getPulseEvents(user.id) });
  } catch (error) {
    console.error("Pulse events lookup failed", error);
    return NextResponse.json({ events: [] });
  }
}
