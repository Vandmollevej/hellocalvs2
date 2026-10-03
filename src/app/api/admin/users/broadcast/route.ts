import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireFullAdminUser } from "@/lib/require-admin";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { BROADCAST_MAX_MESSAGE, BROADCAST_MAX_SUBJECT, queueBroadcast } from "@/lib/admin-broadcast";

// Mail og/eller push til alle brugere. Kræver, at administratoren taster sin
// adgangskode igen for hver udsendelse (docs/DECISIONS.md 2026-10-03).
export async function POST(req: Request) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const email = body?.email === true;
  const push = body?.push === true;

  if (!subject || subject.length > BROADCAST_MAX_SUBJECT || !message || message.length > BROADCAST_MAX_MESSAGE) {
    return NextResponse.json({ message: "Emne eller besked mangler eller er for lang" }, { status: 400 });
  }
  if (!email && !push) return NextResponse.json({ message: "Vælg mail og/eller push" }, { status: 400 });
  if (!password) return NextResponse.json({ message: "Indtast din adgangskode" }, { status: 400 });
  if (!admin.passwordHash) {
    return NextResponse.json({ message: "Kontoen har ingen adgangskode at bekræfte med" }, { status: 409 });
  }

  const rateLimitKey = `broadcast:${admin.id}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }
  if (!(await bcrypt.compare(password, admin.passwordHash))) {
    recordFailure(rateLimitKey);
    return NextResponse.json({ message: "Forkert adgangskode" }, { status: 403 });
  }
  recordSuccess(rateLimitKey);

  const result = await queueBroadcast(subject, message, { email, push });
  console.info(`[broadcast] ${admin.email} sendte "${subject}" (${result.emails} mails, ${result.pushes} push)`);
  return NextResponse.json({ ok: true, ...result });
}
