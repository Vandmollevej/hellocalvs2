import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { setOffImageReview } from "@/lib/off-image-review";
import type { OffImageDecision } from "@/lib/off-image-review-shared";

const MAX_IDS = 500;

// Admin → Open Food Facts → Billeder (docs/DECISIONS.md 2026-10-11): gem
// godkendt/afvist for ét eller flere billeder. decision "RESET" lægger
// billederne tilbage under "Til gennemgang".
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (admin.adminAccessLevel !== "FULL") {
    return NextResponse.json({ message: "Kun administratorer med fuld adgang kan gennemgå billeder." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown; decision?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  const decision = body?.decision;
  if (!ids.length || ids.length > MAX_IDS || (decision !== "APPROVED" && decision !== "REJECTED" && decision !== "RESET")) {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const updated = await setOffImageReview(ids, decision === "RESET" ? null : (decision as OffImageDecision), admin.id);
  return NextResponse.json({ updated });
}
