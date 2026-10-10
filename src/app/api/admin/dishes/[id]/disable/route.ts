import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { IMPORTED_DISH_SOURCES } from "@/lib/meal-kit-providers";

// PATCH /api/admin/dishes/:id/disable — { disabled: boolean }
// Admin → Retter → HelloFresh/RetNemt/BetterFeast/Valdemarsro: det eneste
// admin kan rette på en importeret ret er at deaktivere eller aktivere den
// (docs/DECISIONS.md 2026-10-07). Bruger Product.discontinued, som al søgning,
// Retter-listen og AI-genkendelsen filtrerer på; importerne overskriver ikke
// feltet ved genimport.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { disabled?: unknown } | null;
  if (typeof body?.disabled !== "boolean") return NextResponse.json({ message: "Ugyldigt input" }, { status: 400 });
  const result = await prisma.product.updateMany({
    where: { id, externalSource: { in: [...IMPORTED_DISH_SOURCES] } },
    data: { discontinued: body.disabled },
  });
  if (result.count === 0) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ok: true, disabled: body.disabled });
}
