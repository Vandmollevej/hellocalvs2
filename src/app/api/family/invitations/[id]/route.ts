import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { cancelFamilyInvitation } from "@/lib/family";
import { familyErrorResponse } from "@/lib/family-api";

type RouteContext = { params: Promise<{ id: string }> };

// Betaleren trækker en afventende invitation tilbage; linket holder op med at virke.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const login = await getSessionUser();
  if (!login) return unauthorized();
  const { id } = await params;
  try {
    await cancelFamilyInvitation(login.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return familyErrorResponse(error);
  }
}
