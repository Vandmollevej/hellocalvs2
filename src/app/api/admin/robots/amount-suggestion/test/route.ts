import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { suggestAmount } from "@/lib/amount-suggestion";

// GET /api/admin/robots/amount-suggestion/test?itemId=&userId=&context=
// Viser præcis det forslag, slideren ville få — med eller uden en bestemt
// brugers egen historik.
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId")?.trim();
  if (!itemId) return NextResponse.json({ message: "Angiv et vare-id" }, { status: 400 });
  const userId = url.searchParams.get("userId")?.trim() || null;
  const context = url.searchParams.get("context") === "RECIPE" ? "RECIPE" : "EATEN";

  const suggestion = await suggestAmount({ userId, itemId, context });
  return NextResponse.json({ suggestion });
}
