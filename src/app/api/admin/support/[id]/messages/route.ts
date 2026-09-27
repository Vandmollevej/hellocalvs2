import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { SUPPORT_MESSAGE_MAX, addSupportReply, cleanSupportText } from "@/lib/support-inbox";

// Svar til brugeren eller intern note (docs/DECISIONS.md 2026-09-26
// "Support-indbakke"). Et svar sendes til brugerens indbakke + mail/push.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = cleanSupportText(body?.message, SUPPORT_MESSAGE_MAX);
  if (!text) return NextResponse.json({ message: "Skriv en besked" }, { status: 400 });
  const kind = body?.kind === "NOTE" ? "NOTE" : "REPLY";

  const created = await addSupportReply({
    requestId: id,
    adminName: admin.displayName || "Hello Cal Support",
    body: text,
    kind,
    resolve: kind === "REPLY" && body?.resolve === true,
  });
  if (!created) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
