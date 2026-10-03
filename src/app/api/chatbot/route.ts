import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import {
  CHATBOT_HOURLY_LIMIT,
  askChatbot,
  cleanChatbotQuestion,
  countRecentChatbotQuestions,
  getOpenChatbotConversation,
} from "@/lib/chatbot";

// Hjælpe-chatbot (docs/DECISIONS.md 2026-10-02).
// GET: den igangværende samtale.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ conversation: await getOpenChatbotConversation(user.id) });
}

// POST { question, channel: "APP" | "WEB" } → samtalen med chatbottens svar.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const question = cleanChatbotQuestion(body?.question);
  if (!question) return NextResponse.json({ error: "QUESTION_REQUIRED" }, { status: 400 });
  if ((await countRecentChatbotQuestions(user.id)) >= CHATBOT_HOURLY_LIMIT) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  const channel = body?.channel === "WEB" ? "WEB" : "APP";
  const conversation = await askChatbot({ user, question, channel });
  return NextResponse.json({ conversation });
}
