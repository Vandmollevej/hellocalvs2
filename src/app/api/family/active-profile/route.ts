import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { USER_SESSION_MAX_AGE } from "@/lib/user-auth";
import { ACTIVE_PROFILE_COOKIE, canActFor, logProfileAccess } from "@/lib/family-access";
import { readJson } from "@/lib/family-api";

// "Skift profil": vælg hvilken profil dagbogen viser og taster ind på.
export async function PUT(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  const profileId = typeof body.profileId === "string" ? body.profileId : login.id;
  if (!(await canActFor(login.id, profileId))) {
    return NextResponse.json({ code: "notAllowed" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  if (profileId === login.id) {
    response.cookies.set(ACTIVE_PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    // Samme levetid som sessionen. Adgangen tjekkes igen ved hvert kald.
    response.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: USER_SESSION_MAX_AGE,
    });
    await logProfileAccess(profileId, login.id, "OPENED", "profile");
  }
  return response;
}
