import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

export async function PATCH(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.locale !== "DA" && body.locale !== "EN") {
    return NextResponse.json({ message: "Ugyldigt sprog" }, { status: 400 });
  }

  const user = await prisma.user.update({ where: { id: admin.id }, data: { locale: body.locale } });
  return NextResponse.json({ locale: user.locale });
}
