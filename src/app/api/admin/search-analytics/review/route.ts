import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { reviewSearchMisses } from "@/lib/search-miss-review";

// Admin → Analyse → Søgning: "Vurdér nu" kører vurderingen af søgninger uden
// resultat med det samme i stedet for at vente på nattens kørsel.
export async function POST() {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await reviewSearchMisses());
  } catch (error) {
    console.error("Search miss review failed", error);
    return NextResponse.json({ message: "Vurderingen fejlede" }, { status: 500 });
  }
}
