import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { createFamilyProfile, parseAccessLevel, type NewProfileAccess } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

function optionalNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Rettighederne valgt i formularen: for hvert andet familiemedlem, hvad de må
// hos den nye profil, og hvad den nye profil må hos dem.
function parseAccess(value: unknown): NewProfileAccess[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry.personId !== "string") return [];
    return [
      {
        personId: entry.personId,
        personOnNew: parseAccessLevel(entry.personOnNew) ?? "none",
        newOnPerson: parseAccessLevel(entry.newOnPerson) ?? "none",
      },
    ];
  });
}

// Betaleren opretter et familiemedlem eller et barn (isChild) i familien.
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
      access: parseAccess(body.access),
    });
    return NextResponse.json({ profile: { id: user.id, displayName: user.displayName } }, { status: 201 });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
