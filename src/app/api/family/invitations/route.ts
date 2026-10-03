import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyInvitation } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// "Inviter familiemedlem": betaleren sender en mail med et link til en
// person og vælger, hvilke af familiens profiler personen får indsigt i.
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  const subjectIds = Array.isArray(body.subjectIds)
    ? body.subjectIds.filter((id): id is string => typeof id === "string").slice(0, 10)
    : [];
  try {
    const result = await createFamilyInvitation(login.id, {
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      subjectIds,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
