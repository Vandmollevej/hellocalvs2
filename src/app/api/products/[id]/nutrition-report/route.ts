import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { detectNutritionChanges, USER_EDIT_CONFIDENCE } from "@/lib/nutrition-reports";
import { idFromSecretToken, INBOX_TOKEN_HEADER } from "@/lib/vault/server";

type RouteContext = { params: Promise<{ id: string }> };

// POST { amountGrams, proteinPer100g?, carbsPer100g?, fatPer100g? } — en
// bruger har ændret makroerne via skyderne (docs/DECISIONS.md 2026-09-23).
// Registreringen selv ligger i brugerens boks (docs/PRIVACY.md); her
// oprettes kun den anonyme kontrolsag til Kvalitetskontrol. Serveren afgør
// selv ud fra produktets værdier, om der er en reel ændring. Rapporten får
// aldrig bruger- eller registrerings-ID — kun en valgfri anonym indbakke.
export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  if (user.role === "ADMIN") return NextResponse.json({ reported: false });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const amountGrams = typeof body?.amountGrams === "number" ? body.amountGrams : 0;
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ message: "Produkt ikke fundet" }, { status: 404 });

  const changes = detectNutritionChanges(product, amountGrams, {
    proteinPer100g: num(body?.proteinPer100g),
    carbsPer100g: num(body?.carbsPer100g),
    fatPer100g: num(body?.fatPer100g),
  });
  if (changes.length === 0) return NextResponse.json({ reported: false });

  const inboxId = idFromSecretToken(req.headers.get(INBOX_TOKEN_HEADER));
  const replyInboxId =
    inboxId && (await prisma.vaultInbox.findUnique({ where: { id: inboxId }, select: { id: true } }))
      ? inboxId
      : null;

  await prisma.productNutritionReport.create({
    data: {
      productId: product.id,
      replyInboxId,
      source: "USER_EDIT",
      amountGrams,
      changes,
      confidence: USER_EDIT_CONFIDENCE,
    },
  });
  return NextResponse.json({ reported: true });
}
