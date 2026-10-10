import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { addCustomActivity, listActivityOptions, setActivityFavorite } from "@/lib/activity-types";

// GET: alle aktiviteter, brugeren kan søge i. POST { name }: tilføj egen
// aktivitet (venter på godkendelse i admin → Kvalitetskontrol → Aktiviteter).
export async function GET() {
  const user = await getProfileUser("activities", "VIEWED");
  if (!user) return unauthorized();
  return NextResponse.json({ options: await listActivityOptions(user.id) });
}

export async function POST(req: Request) {
  const user = await getProfileUser("activities", "CREATED");
  if (!user) return unauthorized();
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const option = name ? await addCustomActivity(user.id, name) : null;
  if (!option) return NextResponse.json({ message: "Ugyldigt navn" }, { status: 400 });
  return NextResponse.json({ option });
}

// PUT { key, favorite }: sæt/fjern favorit-bookmark på en aktivitet.
export async function PUT(req: Request) {
  const user = await getProfileUser("activities", "CREATED");
  if (!user) return unauthorized();
  const { key, favorite } = (await req.json().catch(() => ({}))) as { key?: string; favorite?: boolean };
  if (!key || typeof favorite !== "boolean") return NextResponse.json({ message: "Ugyldig forespørgsel" }, { status: 400 });
  await setActivityFavorite(user.id, key, favorite);
  return NextResponse.json({ ok: true });
}
