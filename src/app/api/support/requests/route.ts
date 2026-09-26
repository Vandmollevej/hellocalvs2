import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { isSupportRequestCategory } from "@/lib/support-permissions";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  cleanSupportText,
  createSupportRequest,
  listUserSupportRequests,
} from "@/lib/support-inbox";

// Brugerens egne henvendelser (docs/DECISIONS.md 2026-09-26 "Support-indbakke").
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ requests: await listUserSupportRequests(user.id) });
}

// "Kontakt os" (docs/DECISIONS.md 2026-09-23): internal support request, not
// mailto:. Linked to the user's active grant at the moment of sending, if
// any — writing to Support works without granting any data access.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at kontakte Support" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = cleanSupportText(body?.subject, SUPPORT_SUBJECT_MAX);
  const message = cleanSupportText(body?.message, SUPPORT_MESSAGE_MAX);
  const category = isSupportRequestCategory(body?.category) ? body.category : "OTHER";

  if (!subject || !message) {
    return NextResponse.json({ error: "SUBJECT_AND_MESSAGE_REQUIRED" }, { status: 400 });
  }

  const supportRequest = await createSupportRequest({ userId: user.id, category, subject, message });
  return NextResponse.json({ request: supportRequest }, { status: 201 });
}
