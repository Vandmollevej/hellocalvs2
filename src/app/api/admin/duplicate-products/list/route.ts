import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { GROUPS_PER_PAGE, loadDuplicateProductSlice } from "@/lib/duplicate-review";

// GET /api/admin/duplicate-products/list?offset=&limit= — næste udsnit af
// vare-dubletter til evigheds-scroll på admin "Dubletter" → Varer
// (docs/DECISIONS.md 2026-10-11). `consumed` er antal poster udsnittet dækker.
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(params.get("limit") ?? String(GROUPS_PER_PAGE), 10) || GROUPS_PER_PAGE),
  );

  try {
    return NextResponse.json(await loadDuplicateProductSlice(offset, limit));
  } catch (error) {
    console.error("Duplicate list failed", error);
    return NextResponse.json({ message: "Kunne ikke hente flere" }, { status: 500 });
  }
}
