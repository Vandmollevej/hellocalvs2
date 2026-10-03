import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import {
  getProductPageTagSettings,
  listProductKeywordCounts,
  saveProductPageTagSettings,
} from "@/lib/product-page-tags-settings";

// GET /api/admin/product-page-tags — admins valg af nøgleord til
// produktsiden + alle frie nøgleord med antal varer (docs/DECISIONS.md
// 2026-10-02).
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const [settings, keywords] = await Promise.all([getProductPageTagSettings(), listProductKeywordCounts()]);
  return NextResponse.json({ settings, keywords });
}

// PUT /api/admin/product-page-tags — gem valget. Body: { fields, keywords }.
export async function PUT(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  try {
    const settings = await saveProductPageTagSettings(body, admin.id);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Failed to save product page tag settings", error);
    return NextResponse.json({ message: "Kunne ikke gemme" }, { status: 500 });
  }
}
