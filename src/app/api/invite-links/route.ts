import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createInviteLink, listInviteStatus } from "@/lib/invite-links";
import { APP_BASE_URL } from "@/lib/transient-mail";

// "Invitér en ven" via engangslinks (docs/PRIVACY.md "Sociale funktioner").
// GET: antal åbne links og egne ventende/givne belønninger — aldrig hvem.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine invitationer" }, { status: 401 });
  return NextResponse.json(await listInviteStatus(user.id));
}

// POST: nyt engangslink, som brugeren selv deler.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at invitere" }, { status: 401 });
  try {
    const { code, expiresAt } = await createInviteLink(user.id);
    return NextResponse.json({ url: `${APP_BASE_URL}/signup?ref=${code}`, expiresAt });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Kunne ikke lave et link" },
      { status: 429 }
    );
  }
}
