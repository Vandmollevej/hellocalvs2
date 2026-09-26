import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { removeFamilyMember, setMemberDeletePermission, setMemberIsChild } from "@/lib/family";
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

export async function DELETE(_req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { userId } = await params;
  try {
    await removeFamilyMember(login.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
