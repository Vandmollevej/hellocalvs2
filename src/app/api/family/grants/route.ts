import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseAccessLevel, setAccessGrant } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// Betaleren sætter en persons adgang til et bestemt familiemedlem: level =
// "none", "read" (se profilen) eller "write" (også oprette på deres vegne).
// Det ældre { allowed: boolean } svarer til "write"/"none".
export async function PUT(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  if (typeof body.granteeId !== "string" || typeof body.subjectId !== "string") {
    return NextResponse.json({ code: "invalidRequest" }, { status: 400 });
  }
  const level = parseAccessLevel(body.level) ?? (body.allowed === true ? "write" : body.allowed === false ? "none" : null);
  if (!level) return NextResponse.json({ code: "invalidRequest" }, { status: 400 });
  try {
    await setAccessGrant(login.id, body.granteeId, body.subjectId, level);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
