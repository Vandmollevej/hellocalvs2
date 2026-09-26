import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyProfile } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

function optionalNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Betaleren opretter en ny profil i familien ("Er det et barn?").
export async function POST(req: Request) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const body = await readJson(req);
  const birthDate = typeof body.birthDate === "string" && body.birthDate ? new Date(body.birthDate) : null;
  try {
    const user = await createFamilyProfile(login.id, {
      displayName: typeof body.displayName === "string" ? body.displayName : "",
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
      sex: body.sex === "FEMALE" || body.sex === "MALE" ? body.sex : null,
      isChild: body.isChild === true,
      heightCm: optionalNumber(body.heightCm),
      weightKg: optionalNumber(body.weightKg),
    });
    return NextResponse.json({ profile: { id: user.id, displayName: user.displayName } }, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
