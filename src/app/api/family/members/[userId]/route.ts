import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { deleteFamilyProfile, removeFamilyMember, setMemberDeletePermission, setMemberIsChild } from "@/lib/family";
import { familyErrorResponse, readJson } from "@/lib/family-api";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { userId } = await params;
  const body = await readJson(req);
  try {
    if (typeof body.isChild === "boolean") await setMemberIsChild(login.id, userId, body.isChild);
    if (typeof body.canDeleteOthersEntries === "boolean") {
      await setMemberDeletePermission(login.id, userId, body.canDeleteOthersEntries);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}

// ?deleteProfile=1 + { confirm: "SLET" }: slet en profil uden login og alle
// dens data. Ellers: fjern et medlem med eget login fra familien.
export async function DELETE(req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { userId } = await params;
  try {
    if (new URL(req.url).searchParams.get("deleteProfile") === "1") {
      const body = await readJson(req);
      if (body.confirm !== "SLET") return NextResponse.json({ code: "confirmRequired" }, { status: 400 });
      await deleteFamilyProfile(login.id, userId);
      return NextResponse.json({ ok: true });
    }
    await removeFamilyMember(login.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
