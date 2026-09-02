import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/additives — the entire E-number reference database (~343 rows, read
// infrequently and cached client-side; see src/lib/additives.ts).
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
