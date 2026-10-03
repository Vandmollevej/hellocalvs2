import { NextResponse } from "next/server";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PARTNER_SESSION_COOKIE);
  return response;
}
