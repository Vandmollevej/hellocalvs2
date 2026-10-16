import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { searchFrida } from "@/lib/generic-product-admin";

// GET ?q=123 eller ?q=æble — slå en Frida-vare op på FoodID eller navn, så
// formularen kan vise Frida-navnet og kcal for den valgte kilde.
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchFrida(q) });
}
