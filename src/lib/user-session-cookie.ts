import type { NextResponse } from "next/server";
import { USER_SESSION_COOKIE, USER_SESSION_MAX_AGE, signUserSession } from "@/lib/user-auth";

export async function setUserSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(USER_SESSION_COOKIE, await signUserSession(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });
}
