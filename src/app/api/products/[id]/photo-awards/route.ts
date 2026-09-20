import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Awards en bruger kan optjene points ved at hjælpe med et bedre billede af
// dette produkt (docs/DECISIONS.md, 2026-09-19) — kun enabled+OPEN vises;
// SUBMITTED/RESOLVED skal ikke vises som en ny mulighed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const awards = await prisma.productPhotoAward.findMany({
    where: { productId: id, enabled: true, status: "OPEN" },
    select: { id: true, photoType: true, points: true },
  });
  return NextResponse.json({ awards });
}
