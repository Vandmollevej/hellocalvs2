import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { suggestAmount } from "@/lib/amount-suggestion";

// GET /api/amount-suggestion?itemId=<produkt- eller ingrediens-id>&context=EATEN|RECIPE
// Startmængden til slideren på /add/[id] (mængde-robotten, docs/DECISIONS.md
// 2026-09-25). { suggestion: null } = ingen data, siden beholder sin standard.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const context = url.searchParams.get("context") === "RECIPE" ? "RECIPE" : "EATEN";
  if (!itemId) return NextResponse.json({ message: "itemId mangler" }, { status: 400 });

  try {
    const user = await getSessionUser();
    const suggestion = await suggestAmount({ userId: user?.id ?? null, itemId, context });
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Failed to suggest amount", error);
    return NextResponse.json({ suggestion: null });
  }
}
