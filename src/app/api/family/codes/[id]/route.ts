import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { revokeFamilyCode } from "@/lib/family";
import { familyErrorResponse } from "@/lib/family-api";

type RouteContext = { params: Promise<{ id: string }> };

// Betaleren trækker en ubrugt kode tilbage.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { id } = await params;
  try {
    await revokeFamilyCode(login.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
