import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyCode } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// Engangskode: med profileId sætter medlemmet sit eget login på profilen,
// uden profileId kan en eksisterende bruger sige ja til at komme med.
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  try {
    const result = await createFamilyCode(login.id, typeof body.profileId === "string" ? body.profileId : null);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
