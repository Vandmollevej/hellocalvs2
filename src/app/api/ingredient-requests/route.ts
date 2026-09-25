import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createIngredientRequest, INGREDIENT_NAME_MAX } from "@/lib/ingredient-requests";

// POST { name, inboxId } — en bruger har oprettet sin egen private
// ingrediens (docs/DECISIONS.md 2026-09-24). Kun navnet og en anonym
// engangsindbakke gemmes; aldrig hvem brugeren er.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { name?: unknown; inboxId?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > INGREDIENT_NAME_MAX) {
    return NextResponse.json({ message: "Navn mangler eller er for langt" }, { status: 400 });
  }
  const inboxId = typeof body?.inboxId === "string" ? body.inboxId : null;
  const replyInboxId =
    inboxId && (await prisma.vaultInbox.findUnique({ where: { id: inboxId }, select: { id: true } }))
      ? inboxId
      : null;

  const request = await createIngredientRequest(name, replyInboxId);
  return NextResponse.json({ requestId: request.id }, { status: 201 });
}
