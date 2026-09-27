import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { isSupportPriority, updateSupportRequest } from "@/lib/support-inbox";

// Status, prioritet og "besvaret"-markering for en supportsag
// (docs/DECISIONS.md 2026-09-23 og 2026-09-26 "Support-indbakke").
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status === "RESOLVED" ? "RESOLVED" : body?.status === "OPEN" ? "OPEN" : undefined;
  const priority = isSupportPriority(body?.priority) ? body.priority : undefined;
  const awaitingReply = typeof body?.awaitingReply === "boolean" ? body.awaitingReply : undefined;
  if (!status && !priority && awaitingReply === undefined) {
    return NextResponse.json({ message: "Intet at opdatere" }, { status: 400 });
  }

  const updated = await updateSupportRequest(id, { status, priority, awaitingReply });
  if (!updated) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
