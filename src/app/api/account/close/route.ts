import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { anonymizeUser } from "@/lib/gdpr";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/family-access";

// Brugerens egen "Luk konto" og "Ret til at blive glemt" (Kontoindstillinger).
// Begge kører den samme GDPR-anonymisering som admin-flowet (src/lib/gdpr.ts,
// docs/DECISIONS.md 2026-09-02) og logger ud bagefter.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { mode?: string; confirm?: string };
  if (body.mode !== "close" && body.mode !== "forget") {
    return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
  }
  if (body.confirm !== "SLET") {
    return NextResponse.json({ message: "Bekræftelse mangler" }, { status: 400 });
  }

  try {
    await anonymizeUser(user.id, user.id);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Kunne ikke lukke kontoen" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(ACTIVE_PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
