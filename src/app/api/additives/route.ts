import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/additives — hele E-nummer-referencedatabasen (~343 rækker, læses
// sjældent og cachet klient-side; se src/lib/additives.ts).
export async function GET() {
  try {
    const additives = await prisma.additive.findMany({
      orderBy: { eNumber: "asc" },
    });
    return NextResponse.json({ additives });
  } catch (error) {
    console.error("Additive lookup failed", error);
    return NextResponse.json(
      { error: "Kunne ikke hente E-nummer-database" },
      { status: 500 },
    );
  }
}
