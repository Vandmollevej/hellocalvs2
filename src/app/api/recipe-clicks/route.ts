import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Registrerer et klik på en ret i Delte retter til "Trender netop nu".
// POST { key } med key = "shared:<id>" | "hf:<id>" (Valdemarsro bruger "hf:").
// Samme bruger tæller højst én gang pr. ret pr. time, så gentagne tryk ikke
// kan skubbe en ret op.

const KEY_PATTERN = /^(shared|hf):[A-Za-z0-9_-]{1,64}$/;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  if (!KEY_PATTERN.test(key)) return NextResponse.json({ message: "Ugyldig nøgle" }, { status: 400 });
  try {
    const recent = await prisma.recipeClick.findFirst({
      where: { userId: user.id, recipeKey: key, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (!recent) await prisma.recipeClick.create({ data: { userId: user.id, recipeKey: key } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recipe click failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
