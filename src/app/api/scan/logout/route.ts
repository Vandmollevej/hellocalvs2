import { NextResponse } from "next/server";
import { SCAN_SESSION_COOKIE } from "@/lib/scan/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SCAN_SESSION_COOKIE);
  return response;
}
