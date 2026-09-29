import { NextResponse } from "next/server";
import { parseBusinessContact, sendBusinessContact } from "@/lib/business-contact";
import { MailNotConfiguredError } from "@/lib/transient-mail";

// Offentlig kontaktformular for business-partnere og presse (/business).
// Enkel spambeskyttelse: skjult felt ("website") og højst 5 henvendelser pr.
// IP pr. 10 minutter (i hukommelsen — én container).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function tooMany(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Bots udfylder det skjulte felt — svar "ok" uden at sende.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });
  if (tooMany(clientIp(req))) {
    return NextResponse.json({ message: "For mange henvendelser. Prøv igen om lidt." }, { status: 429 });
  }

  const input = parseBusinessContact(body);
  if (typeof input === "string") return NextResponse.json({ message: input }, { status: 400 });

  try {
    await sendBusinessContact(input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (!(error instanceof MailNotConfiguredError)) console.error("[business-contact] mail fejlede", error);
    return NextResponse.json({ message: "Beskeden kunne ikke sendes lige nu. Prøv igen senere." }, { status: 502 });
  }
}
