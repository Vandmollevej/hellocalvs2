import { NextResponse } from "next/server";
import type { DoctorShareHistoryRange } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { sanitizeDoctorShareCategories, isDoctorShareHistoryRange } from "@/lib/doctor-share";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se denne invitation" }, { status: 401 });

  const { id } = await params;
  const share = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id } });
  if (!share) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

  return NextResponse.json({ share });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at redigere denne invitation" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.doctorShare.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

  let body: { name?: string; email?: string; categories?: unknown; historyRange?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const data: {
    name?: string;
    email?: string;
    categories?: string[];
    historyRange?: DoctorShareHistoryRange;
  } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ message: "Angiv et navn" }, { status: 400 });
    data.name = name;
  }
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
    }
    data.email = email;
  }
  if (body.categories !== undefined) {
    data.categories = sanitizeDoctorShareCategories(body.categories);
  }
  if (body.historyRange !== undefined && isDoctorShareHistoryRange(body.historyRange)) {
    data.historyRange = body.historyRange;
  }

  const share = await prisma.doctorShare.update({ where: { id }, data });
  return NextResponse.json({ share });
}
