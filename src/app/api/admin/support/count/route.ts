import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { countSupportInbox } from "@/lib/support-inbox";

// Tæller til "Support (3)" i admin-menuen (docs/DECISIONS.md 2026-09-26).
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await countSupportInbox());
}
