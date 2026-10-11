import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { parseBulkRequest } from "@/lib/admin-bulk-actions";
import { runBulkAction } from "@/lib/admin-bulk";
import { invalidateUncertaintyCache } from "@/lib/uncertainties";
import { invalidateDuplicateCache } from "@/lib/duplicate-review";

// POST /api/admin/bulk — { kind: "product" | "recipe", action, ids: string[] }
// Fælles rute for admin-listernes "Handlinger"-menu og til/fra-knappen på en
// enkelt række (docs/DECISIONS.md 2026-10-11).
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const request = parseBulkRequest(await req.json().catch(() => null));
  if (!request) return NextResponse.json({ message: "Ugyldigt input" }, { status: 400 });
  const changed = await runBulkAction(request.kind, request.action, request.ids);
  // Usikkerhedslisterne cacher i 30 s; slettede/deaktiverede varer skal væk med det samme.
  invalidateUncertaintyCache();
  invalidateDuplicateCache();
  return NextResponse.json({ ok: true, changed });
}
