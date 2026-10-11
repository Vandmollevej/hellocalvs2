import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { parseBulkRequest } from "@/lib/admin-bulk-actions";
import { runBulkAction } from "@/lib/admin-bulk";

// POST /api/admin/bulk — { kind: "product" | "recipe", action, ids: string[] }
// Fælles rute for admin-listernes "Handlinger"-menu og til/fra-knappen på en
// enkelt række (docs/DECISIONS.md 2026-10-11).
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const request = parseBulkRequest(await req.json().catch(() => null));
  if (!request) return NextResponse.json({ message: "Ugyldigt input" }, { status: 400 });
  const changed = await runBulkAction(request.kind, request.action, request.ids);
  return NextResponse.json({ ok: true, changed });
}
