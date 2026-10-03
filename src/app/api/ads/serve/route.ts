import { NextResponse } from "next/server";
import { selectAds } from "@/lib/ad-serving";

// Reklamer til en plads i appen, evt. udløst af varens kategori/type
// (docs/DECISIONS.md 2026-10-02). GET ?slot=product_page&category=DRINK&productType=Skyr
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot") ?? "";
  const ads = await selectAds(slot, {
    category: url.searchParams.get("category"),
    productType: url.searchParams.get("productType"),
  });
  return NextResponse.json({ ads });
}
