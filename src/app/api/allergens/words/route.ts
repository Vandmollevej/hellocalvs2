import { NextResponse } from "next/server";
import { approvedAllergenWords } from "@/lib/allergen-words";

// GET /api/allergens/words — godkendte allergen-ord fra allergen-robotten
// (docs/DECISIONS.md 2026-10-17). Web (IngredientsText) og app
// (IngredientsTextView) fremhæver og linker dem som de faste allergener.
export async function GET() {
  const words = await approvedAllergenWords().catch(() => []);
  return NextResponse.json({ words }, { headers: { "Cache-Control": "public, max-age=600" } });
}
