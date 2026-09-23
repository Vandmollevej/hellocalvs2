import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { sanitizeDoctorShareCategories, isDoctorShareHistoryRange } from "@/lib/doctor-share";
import { SHARE_SELECT } from "@/lib/doctor-share-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se denne invitation" }, { status: 401 });
  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id }, select: SHARE_SELECT });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ share });
}

// PATCH { categories?, historyRange? } — navn/e-mail ændres i ejerens boks.
export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at redigere denne invitation" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { categories?: unknown; historyRange?: unknown } | null;
  const share = await prisma.doctorShare.update({
    where: { id },
    data: {
      ...(body?.categories !== undefined ? { categories: sanitizeDoctorShareCategories(body.categories) } : {}),
      ...(isDoctorShareHistoryRange(body?.historyRange) ? { historyRange: body.historyRange } : {}),
    },
    select: SHARE_SELECT,
  });
  return NextResponse.json({ share });
}
