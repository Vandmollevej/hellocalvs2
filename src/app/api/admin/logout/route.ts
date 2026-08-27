import { NextResponse } from "next/server";
import { ADMIN_MFA_COOKIE, ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_MFA_COOKIE);
  return response;
}
