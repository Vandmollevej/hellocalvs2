import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { chooseWebCandidate } from "@/lib/product-image-search";

// Admin vælger et originalbillede fundet online (docs/DECISIONS.md 2026-10-15).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
  if (!candidateId) return NextResponse.json({ message: "candidateId mangler" }, { status: 400 });
  const result = await chooseWebCandidate(id, candidateId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
