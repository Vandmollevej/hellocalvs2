import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { cleanSupportText, SUPPORT_MESSAGE_MAX } from "@/lib/support-inbox";
import { escalateChatbotConversation } from "@/lib/chatbot";

// "Tal med en medarbejder" (docs/DECISIONS.md 2026-10-02): samtalen sendes
// til Support-indbakken som en sag. Body: { conversationId?, note?, channel }.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  const note = cleanSupportText(body?.note, SUPPORT_MESSAGE_MAX);
  const channel = body?.channel === "WEB" ? "WEB" : "APP";
  const result = await escalateChatbotConversation({ user, conversationId, note, channel });
  if (!result) return NextResponse.json({ error: "NOTHING_TO_SEND" }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
