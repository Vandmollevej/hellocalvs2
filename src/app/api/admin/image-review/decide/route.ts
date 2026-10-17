import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { decideReviews } from "@/lib/image-review";

// POST /api/admin/image-review/decide { ids, action: "ACCEPT" | "REJECT" } —
// ét kald = én logpost (bulk foldes sammen i loggen).
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ids?: unknown; action?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 2000) : [];
  if (ids.length === 0 || (body?.action !== "ACCEPT" && body?.action !== "REJECT")) {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const result = await decideReviews(ids, body.action, admin.id);
  return NextResponse.json(result);
}
