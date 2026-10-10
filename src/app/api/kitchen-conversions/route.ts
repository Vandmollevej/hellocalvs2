import { NextResponse } from "next/server";
import { KITCHEN_CONVERSION_GROUPS, KITCHEN_CONVERSIONS } from "@/lib/kitchen-conversions";

// GET /api/kitchen-conversions — omregningstabellen væsker → gram
// (src/data/kitchen-conversions.json) til den native app, der viser den under
// Viden om mad og bruger den til Mål/Gram-skiftet på retter.
export async function GET() {
  return NextResponse.json(
    { groups: KITCHEN_CONVERSION_GROUPS, items: KITCHEN_CONVERSIONS },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
