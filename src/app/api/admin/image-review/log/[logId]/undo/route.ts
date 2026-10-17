import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { undoLog } from "@/lib/image-review";

// POST /api/admin/image-review/log/[logId]/undo — fortryder en hel logpost.
export async function POST(_req: Request, { params }: { params: Promise<{ logId: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { logId } = await params;
  const result = await undoLog(logId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
