import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  SUPPORT_MESSAGE_MAX,
  addUserSupportMessage,
  cleanSupportText,
  getUserSupportThread,
} from "@/lib/support-inbox";

// Én henvendelse set fra brugeren: tråden uden interne noter
// (docs/DECISIONS.md 2026-09-26 "Support-indbakke").
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const thread = await getUserSupportThread(user.id, id);
  if (!thread) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ request: thread });
}

// Brugerens svar i tråden.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const message = cleanSupportText(body?.message, SUPPORT_MESSAGE_MAX);
  if (!message) return NextResponse.json({ error: "MESSAGE_REQUIRED" }, { status: 400 });

  const created = await addUserSupportMessage(user.id, id, message);
  if (!created) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ message: { id: created.id, createdAt: created.createdAt } }, { status: 201 });
}
