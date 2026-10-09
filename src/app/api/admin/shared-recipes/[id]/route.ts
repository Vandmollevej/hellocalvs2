import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { queueMessage } from "@/lib/messaging";

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

  const recipe = await prisma.sharedRecipe.findUnique({ where: { id }, select: { publisherHash: true, copyFlagged: true } });
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

  // Afvisning af en kopi-flaget ret kræver en begrundelse (brugerens krav
  // 2026-10-07); den gemmes på retten.
  const reason = typeof (body as { reason?: unknown }).reason === "string" ? (body as { reason: string }).reason.trim().slice(0, 1000) : "";
  if (action === "REJECT" && recipe.copyFlagged && !reason) {
    return NextResponse.json({ message: "Angiv en begrundelse for afvisningen" }, { status: 400 });
  }
  await prisma.sharedRecipe.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      ...(action === "REJECT" && reason ? { rejectionReason: reason } : {}),
    },
  });
  // Ejeren får besked i Profil → Beskeder om afvisningen og begrundelsen.
  if (action === "REJECT") {
    const dish = await prisma.dish.findFirst({
      where: { sharedRecipeId: id },
      select: { name: true, ownerId: true },
    });
    if (dish) {
      await queueMessage("RECIPE_SHARE_REJECTED", {
        userId: dish.ownerId,
        vars: { dishName: dish.name, reason: reason || "Retten ligner en anden ret for meget." },
      }).catch((error) => console.error("Reject message failed", error));
    }
  }
  return NextResponse.json({ ok: true });
}
