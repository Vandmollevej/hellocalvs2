import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/session";
import { seedPresetScreenings } from "@/lib/screenings-server";

type Texts = Record<string, { name: string; purpose: string; question: string; min: string; max: string }>;

// Klienten sender de forudlavede screeningers tekster på brugerens sprog.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { texts?: Texts } | null;
  const texts: Texts = {};
  for (const [key, value] of Object.entries(body?.texts ?? {})) {
    texts[key] = {
      name: String(value?.name ?? "").slice(0, 60),
      purpose: String(value?.purpose ?? "").slice(0, 300),
      question: String(value?.question ?? "").slice(0, 200),
      min: String(value?.min ?? "").slice(0, 30),
      max: String(value?.max ?? "").slice(0, 30),
    };
  }
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    await seedPresetScreenings(user.id, texts);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Screenings seed failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
