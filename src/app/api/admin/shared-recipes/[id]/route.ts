import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin-afgørelse på en delt ret (docs/DECISIONS.md 2026-09-24):
// APPROVE — godkendt; "Anmeld" forsvinder for brugerne.
// REJECT — skjules for andre; ejeren beholder retten i sin boks.
// BLOCK — udgiveren (pseudonym) kan ikke dele flere retter, og alle dennes
//         delte retter skjules. Rører ikke brugerens konto.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "APPROVE" && action !== "REJECT" && action !== "BLOCK") {
    return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
  }

  const recipe = await prisma.sharedRecipe.findUnique({ where: { id }, select: { publisherHash: true } });
  if (!recipe) return NextResponse.json({ message: "Retten findes ikke" }, { status: 404 });

  if (action === "BLOCK") {
    await prisma.$transaction([
      prisma.sharedRecipePublisherBlock.upsert({
        where: { publisherHash: recipe.publisherHash },
        create: { publisherHash: recipe.publisherHash },
        update: {},
      }),
      prisma.sharedRecipe.updateMany({
        where: { publisherHash: recipe.publisherHash },
        data: { status: "REJECTED", reviewedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  await prisma.sharedRecipe.update({
    where: { id },
    data: { status: action === "APPROVE" ? "APPROVED" : "REJECTED", reviewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
