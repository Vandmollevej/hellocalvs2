import { NextResponse } from "next/server";
import { verifyImpersonationHandoff, signImpersonatedUserSession, USER_SESSION_COOKIE, USER_SESSION_MAX_AGE } from "@/lib/user-auth";

// Veksler admin-panelets 2-minutters engangs-link til en rigtig
// brugersession på dette host (docs/DECISIONS.md 2026-09-02) — se
// src/app/api/admin/users/[id]/impersonate/route.ts for hvorfor dette
// tokenskifte findes (adminhellocal.packroff.dk og hellocal.packroff.dk er
// forskellige hosts).
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ message: "Mangler token" }, { status: 400 });
  }

  const handoff = await verifyImpersonationHandoff(token);
  if (!handoff) {
    return NextResponse.json({ message: "Linket er udløbet eller ugyldigt" }, { status: 401 });
  }

  const session = await signImpersonatedUserSession(handoff.userId, handoff.adminId);
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set(USER_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });
  return response;
}
