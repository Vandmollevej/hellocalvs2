import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";

// POST /api/admin/image-review/suggestions/decide { items: [{ id, title, action }] }
// Billedforslag (godkendelsessiden): selve beslutningen tages af de eksisterende
// routes under /api/admin/products/[id]/image/…; her skrives kun logposten, så
// bulk-handlinger står som én foldbar linje i samme log som Fritlagte billeder.
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    items?: { id?: unknown; title?: unknown }[];
  } | null;
  const items = (body?.items ?? [])
    .filter((item) => typeof item.id === "string")
    .slice(0, 2000)
    .map((item) => ({ id: String(item.id), title: String(item.title ?? "").slice(0, 200) }));
  if (items.length === 0 || (body?.action !== "ACCEPT" && body?.action !== "REJECT")) {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  await prisma.imageReviewLog.create({
    data: { scope: "SUGGESTION", action: body.action, itemCount: items.length, items, createdById: admin.id },
  });
  return NextResponse.json({ ok: true });
}
