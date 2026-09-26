import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { leaveFamily } from "@/lib/family";
import { familyErrorResponse } from "@/lib/family-api";

// Medlemmet melder sig ud og låser de andre ude (fra 15 år for børn).
export async function POST() {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  try {
    await leaveFamily(login.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
