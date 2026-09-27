import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/family-access";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(ACTIVE_PROFILE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
