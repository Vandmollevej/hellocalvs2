import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/email-link";
import { isPlausibleEmail, normalizeEmail } from "@/lib/email-hash";
import { isLocked, recordFailure } from "@/lib/rate-limit";
import { APP_BASE_URL, MailNotConfiguredError, sendTransientMail } from "@/lib/transient-mail";

const TOPICS = ["UPDATES", "ADVICE", "PARTNER_OFFERS"] as const;

// POST { email, topics } — separat tilmelding til nyhedsbrevet
// (docs/PRIVACY.md). Tilmeldingen er ikke koblet til en konto og kræver
// bekræftelse via link i mailen (dobbelt opt-in).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; topics?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const topics = Array.isArray(body?.topics)
    ? TOPICS.filter((topic) => (body!.topics as unknown[]).includes(topic))
    : [];
  if (!isPlausibleEmail(email) || topics.length === 0) {
    return NextResponse.json({ message: "Angiv en gyldig e-mail og mindst ét emne" }, { status: 400 });
  }
  const rateKey = `newsletter:${email}`;
  if (isLocked(rateKey)) return NextResponse.json({ ok: true });
  recordFailure(rateKey);

  const token = randomBytes(32).toString("base64url");
  await prisma.newsletterSubscription.upsert({
    where: { email },
    create: { email, topics, tokenHash: hashToken(token) },
    update: { topics, tokenHash: hashToken(token) },
  });
  const confirm = `${APP_BASE_URL}/nyhedsbrev?action=confirm&t=${token}`;
  const unsubscribe = `${APP_BASE_URL}/nyhedsbrev?action=unsubscribe&t=${token}`;
  try {
    await sendTransientMail({
      to: email,
      subject: "Bekræft din tilmelding til Hello Cals nyhedsbrev",
      html: `<p>Tryk her for at bekræfte: <a href="${confirm}">Bekræft tilmelding</a></p><p>Fortrudt? <a href="${unsubscribe}">Afmeld</a></p><p>Tilmeldingen er ikke koblet til din Hello Cal-konto.</p>`,
      devLink: confirm,
    });
  } catch (error) {
    if (error instanceof MailNotConfiguredError) {
      return NextResponse.json({ message: "Mail kan ikke sendes lige nu" }, { status: 503 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}

// PATCH { action: "confirm" | "unsubscribe", token }
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { action?: unknown; token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const subscription = token
    ? await prisma.newsletterSubscription.findUnique({ where: { tokenHash: hashToken(token) } })
    : null;
  if (!subscription) return NextResponse.json({ message: "Linket er ugyldigt" }, { status: 404 });
  if (body?.action === "confirm") {
    await prisma.newsletterSubscription.update({ where: { id: subscription.id }, data: { confirmedAt: new Date() } });
    return NextResponse.json({ status: "confirmed" });
  }
  if (body?.action === "unsubscribe") {
    await prisma.newsletterSubscription.delete({ where: { id: subscription.id } });
    return NextResponse.json({ status: "unsubscribed" });
  }
  return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
}
