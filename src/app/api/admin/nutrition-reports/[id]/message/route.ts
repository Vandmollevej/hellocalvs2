import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { sealToPublicKey } from "@/lib/vault/crypto";

const MAX_MESSAGE_CHARS = 2000;

// Besked fra admin til indberetteren af en næringsrettelse (docs/PRIVACY.md,
// docs/DECISIONS.md 2026-09-23). Beskeden forsegles til indberetterens
// VaultInbox og kan kun åbnes af brugerens egen enhed. Admin og server ved
// ikke, hvem modtageren er.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ message: "Beskeden mangler eller er for lang" }, { status: 400 });
  }

  const report = await prisma.productNutritionReport.findUnique({
    where: { id },
    select: { replyInboxId: true, product: { select: { name: true } } },
  });
  if (!report) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (!report.replyInboxId) {
    return NextResponse.json({ message: "Indberetteren kan ikke kontaktes" }, { status: 409 });
  }

  const inbox = await prisma.vaultInbox.findUnique({ where: { id: report.replyInboxId } });
  if (!inbox) return NextResponse.json({ message: "Indberetteren kan ikke kontaktes" }, { status: 409 });

  const sealed = await sealToPublicKey(inbox.publicKey, {
    kind: "ADMIN_MESSAGE",
    context: "NUTRITION_REPORT",
    productName: report.product.name,
    message,
    sentAt: new Date().toISOString(),
  });
  await prisma.vaultInboxItem.create({ data: { inboxId: inbox.id, ...sealed } });
  return NextResponse.json({ ok: true });
}
