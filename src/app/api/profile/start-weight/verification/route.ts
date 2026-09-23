import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hashEmail, isPlausibleEmail, normalizeEmail } from "@/lib/email-hash";
import { sameHash } from "@/lib/recovery";
import { createStartWeightChangeToken } from "@/lib/start-weight-verification";
import { APP_BASE_URL, MailNotConfiguredError, sendTransientMail } from "@/lib/transient-mail";
import { isLocked, recordFailure } from "@/lib/rate-limit";

// POST { email } — sender verificeringsmail til ændring af den låste
// start-vægt (docs/DECISIONS.md 2026-09-22). Hello Cal kender ikke
// brugerens e-mail (docs/PRIVACY.md): brugeren taster den, og den skal
// passe til kontoens e-mail-hash. Mailen sendes direkte og gemmes ikke.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.emailHash) return NextResponse.json({ message: "Log ind først" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const rateKey = `start-weight-mail:${user.id}`;
  if (isLocked(rateKey)) return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  recordFailure(rateKey);
  if (!isPlausibleEmail(email) || !sameHash(hashEmail(email), user.emailHash)) {
    return NextResponse.json({ message: "E-mailen passer ikke til din konto" }, { status: 400 });
  }

  try {
    const rawToken = await createStartWeightChangeToken(user.id);
    const link = `${APP_BASE_URL}/profile/start-weight/verify?token=${rawToken}`;
    await sendTransientMail({
      to: email,
      subject: "Ændr din startvægt i Hello Cal",
      html: `<p>Du har bedt om at ændre din startvægt i Hello Cal.</p><p><a href="${link}">Ændr startvægt</a></p><p>Linket kan kun bruges én gang og udløber efter 30 minutter. Hvis det ikke var dig, kan du ignorere mailen.</p>`,
      devLink: link,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MailNotConfiguredError) {
      return NextResponse.json({ message: "Mail kan ikke sendes lige nu" }, { status: 503 });
    }
    console.error("Start-weight verification request failed");
    return NextResponse.json({ message: "Kunne ikke sende verificeringsmail" }, { status: 500 });
  }
}
