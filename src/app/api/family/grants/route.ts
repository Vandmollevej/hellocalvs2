import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { setAccessGrant } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// Betaleren giver/fjerner en persons adgang til et bestemt familiemedlem.
export async function PUT(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  if (typeof body.granteeId !== "string" || typeof body.subjectId !== "string") {
    return NextResponse.json({ code: "invalidRequest" }, { status: 400 });
  }
  try {
    await setAccessGrant(login.id, body.granteeId, body.subjectId, body.allowed === true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
