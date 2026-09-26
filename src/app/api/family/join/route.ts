import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { joinFamily } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  try {
    await joinFamily(login.id, typeof body.code === "string" ? body.code : "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
