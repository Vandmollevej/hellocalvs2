import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyInvitation } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// "Inviter familiemedlem": betaleren sender en mail med et link til en
// person og vælger, hvilke af familiens profiler personen må se
// (subjectIds), og hvilke af dem personen også må oprette for (writeSubjectIds).
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 10) : [];
  const subjectIds = ids(body.subjectIds);
  try {
    const result = await createFamilyInvitation(login.id, {
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      subjectIds,
      writeSubjectIds: ids(body.writeSubjectIds),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
