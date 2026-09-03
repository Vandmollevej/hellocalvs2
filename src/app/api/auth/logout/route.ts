import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
