import { NextResponse } from "next/server";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { getOpenAiUsage, saveBalance } from "@/lib/openai-usage";

export const dynamic = "force-dynamic";

// Admin → OpenAI: status, forbrug og resterende kredit (src/lib/openai-usage.ts).
export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  return NextResponse.json(await getOpenAiUsage(new Date(), force));
}

// Ny kreditsaldo fra OpenAI's Billing-side (dollar).
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { usd?: unknown };
  const usd = Number(String(body.usd ?? "").replace(",", "."));
  if (!Number.isFinite(usd) || usd < 0 || usd > 1_000_000) {
    return NextResponse.json({ message: "Skriv saldoen som et tal i dollar." }, { status: 400 });
  }
  await saveBalance(usd, admin.id);
  return NextResponse.json(await getOpenAiUsage());
}
