import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { cleanIngredientName, createPrivateIngredient, listPrivateIngredients } from "@/lib/private-ingredients";

// GET ?q= — brugerens egne ingredienser. POST { name } — opret en.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  return NextResponse.json({ ingredients: await listPrivateIngredients(user.id, q) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = cleanIngredientName(body?.name);
  if (!name) return NextResponse.json({ message: "Giv ingrediensen et navn" }, { status: 400 });
  return NextResponse.json({ ingredient: await createPrivateIngredient(user.id, name) }, { status: 201 });
}
