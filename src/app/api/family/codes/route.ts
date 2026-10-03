import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyCode, listPendingFamilyCodes } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

// Betalerens ventende koder med QR-kode (familiesiden).
export async function GET() {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  try {
    return NextResponse.json({ codes: await listPendingFamilyCodes(login.id) });
  } catch (error) {
    return familyErrorResponse(error);
  }
}

// Engangskode bundet til en e-mail: med profileId sætter medlemmet sit eget
// login på profilen, uden profileId kan en eksisterende bruger sige ja til at
// komme med.
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  try {
    const result = await createFamilyCode(
      login.id,
      typeof body.profileId === "string" ? body.profileId : null,
      typeof body.email === "string" ? body.email : ""
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
