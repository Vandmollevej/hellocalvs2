import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { addIngredientRequestGlobally, INGREDIENT_NAME_MAX } from "@/lib/ingredient-requests";

// PATCH { action: "add", name? } | { action: "reject" } — admin tager
// stilling til en ønsket ingrediens (docs/DECISIONS.md 2026-09-24). "add"
// opretter den globalt (evt. med rettet navn) og sender den til brugerens
// anonyme indbakke; "reject" lader brugerens private ingrediens være.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown; name?: unknown } | null;
  const request = await prisma.ingredientRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ message: "Allerede behandlet" }, { status: 409 });

  if (body?.action === "reject") {
    await prisma.ingredientRequest.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== "add") return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : request.name;
  if (name.length > INGREDIENT_NAME_MAX) return NextResponse.json({ message: "Navnet er for langt" }, { status: 400 });
  const ingredient = await addIngredientRequestGlobally(id, name, admin.id);
  if (!ingredient) return NextResponse.json({ message: "Allerede behandlet" }, { status: 409 });
  return NextResponse.json({ ok: true, ingredient });
}
