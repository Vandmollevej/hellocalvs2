import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { queueMessage } from "@/lib/messaging";

const MAX_MESSAGE_CHARS = 2000;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

// Besked fra admin til indberetteren af en næringsrettelse, sendt på mail
// (ADMIN_MESSAGE-skabelonen).
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
    select: { reporter: { select: { id: true, displayName: true } }, product: { select: { name: true } } },
  });
  if (!report) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (!report.reporter) {
    return NextResponse.json({ message: "Indberetteren kan ikke kontaktes" }, { status: 409 });
  }

  await queueMessage("ADMIN_MESSAGE", {
    userId: report.reporter.id,
    vars: {
      displayName: escapeHtml(report.reporter.displayName),
      productName: escapeHtml(report.product.name),
      message: escapeHtml(message),
    },
  });
  return NextResponse.json({ ok: true });
}
