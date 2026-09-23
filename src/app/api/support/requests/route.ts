import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { findActiveSupportGrant } from "@/lib/support-access";
import { isSupportRequestCategory } from "@/lib/support-permissions";

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 5000;

// "Kontakt os" (docs/DECISIONS.md 2026-09-23): internal support request, not
// mailto:. Linked to the user's active grant at the moment of sending, if
// any — writing to Support works without granting any data access.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at kontakte Support" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, SUBJECT_MAX) : "";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MESSAGE_MAX) : "";
  const category = isSupportRequestCategory(body?.category) ? body.category : "OTHER";

  if (!subject || !message) {
    return NextResponse.json({ error: "SUBJECT_AND_MESSAGE_REQUIRED" }, { status: 400 });
  }

  const grant = await findActiveSupportGrant(user.id);
  const supportRequest = await prisma.supportRequest.create({
    data: { userId: user.id, category, subject, message, supportGrantId: grant?.id },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ request: supportRequest }, { status: 201 });
}
