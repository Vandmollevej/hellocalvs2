import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  cleanIngredientName,
  deletePrivateIngredient,
  getPrivateIngredient,
  renamePrivateIngredient,
} from "@/lib/private-ingredients";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const ingredient = await getPrivateIngredient(user.id, id);
  if (!ingredient) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ingredient });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = cleanIngredientName(body?.name);
  if (!name) return NextResponse.json({ message: "Giv ingrediensen et navn" }, { status: 400 });
  const ingredient = await renamePrivateIngredient(user.id, id, name);
  if (!ingredient) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ingredient });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  if (!(await deletePrivateIngredient(user.id, id))) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
