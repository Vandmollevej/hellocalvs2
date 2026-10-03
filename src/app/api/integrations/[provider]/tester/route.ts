import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { metaBySlug } from "@/lib/integrations";
import { claimTesterSlot, getTesterOffer, TesterSlotTakenError } from "@/lib/integration-testers";

// GET/POST /api/integrations/<app>/tester — testperson-programmet
// (docs/DECISIONS.md 2026-10-02). GET fortæller, om pladsen er ledig, og om
// brugeren selv har den; POST tilmelder brugeren som første testperson.
export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const meta = metaBySlug((await ctx.params).provider);
  if (!meta) return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await getTesterOffer(user.id, meta.provider));
  } catch (error) {
    console.error("Tester offer failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const meta = metaBySlug((await ctx.params).provider);
  if (!meta) return NextResponse.json({ message: "Ukendt integration" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    await claimTesterSlot(user.id, meta.provider);
    return NextResponse.json(await getTesterOffer(user.id, meta.provider));
  } catch (error) {
    if (error instanceof TesterSlotTakenError) {
      return NextResponse.json({ message: "Pladsen er allerede taget" }, { status: 409 });
    }
    console.error("Tester signup failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
