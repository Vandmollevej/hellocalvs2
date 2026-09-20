import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin-afgørelse på en ProductMatchCheck (docs/DECISIONS.md, 2026-09-19):
// CORRECT/WRONG/UNCERTAIN gemmes permanent som fremtidig træningsdata til en
// senere lokal Hello Cal-model (brugerens eksplicitte "Ja" til dette). Denne
// route ændrer aldrig produktets egne felter — kun match-checkens egen status.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const verdict = body?.verdict;
  if (verdict !== "CORRECT" && verdict !== "WRONG" && verdict !== "UNCERTAIN") {
    return NextResponse.json({ message: "Ugyldig afgørelse" }, { status: 400 });
  }

  const matchCheck = await prisma.productMatchCheck.update({
    where: { id },
    data: { adminVerdict: verdict, status: "REVIEWED", reviewedAt: new Date() },
  });
  return NextResponse.json({ matchCheck });
}
