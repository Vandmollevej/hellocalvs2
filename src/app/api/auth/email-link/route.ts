import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashEmail, isPlausibleEmail, normalizeEmail } from "@/lib/email-hash";
import { createEmailLinkToken } from "@/lib/email-link";
import { APP_BASE_URL, MailNotConfiguredError, sendTransientMail } from "@/lib/transient-mail";
import { isLocked, recordFailure } from "@/lib/rate-limit";

// POST /api/auth/email-link — { email, purpose: "signup" | "recovery" }
//
// Sender et engangslink til den tastede adresse. Adressen gemmes aldrig, kun
// dens hash (docs/PRIVACY.md). Svaret afslører aldrig, om en konto findes.
// Tokenet ligger i URL-fragmentet (#t=…), så det ikke havner i serverlogs.
const GENERIC = { message: "Hvis adressen er gyldig, har vi sendt dig en mail med et link." };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; purpose?: unknown } | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const purpose = body?.purpose === "recovery" ? "recovery" : body?.purpose === "signup" ? "signup" : null;
  if (!purpose || !isPlausibleEmail(email)) {
    return NextResponse.json({ message: "Angiv en gyldig e-mailadresse" }, { status: 400 });
  }

  const emailHash = hashEmail(email);
  const rateKey = `email-link:${emailHash}`;
  if (isLocked(rateKey)) return NextResponse.json(GENERIC);
  recordFailure(rateKey);

  const existing = await prisma.user.findUnique({ where: { emailHash }, select: { id: true, forgottenAt: true } });
  const active = existing && !existing.forgottenAt;

  try {
    if (purpose === "signup") {
      if (active) {
        await sendTransientMail({
          to: email,
          subject: "Du har allerede en Hello Cal-konto",
          html: `<p>Der findes allerede en Hello Cal-konto med denne e-mail. Log ind med din passkey, eller gendan adgangen her:</p><p><a href="${APP_BASE_URL}/gendan">${APP_BASE_URL}/gendan</a></p>`,
          devLink: `${APP_BASE_URL}/gendan`,
        });
      } else {
        const token = await createEmailLinkToken("SIGNUP", emailHash);
        const link = `${APP_BASE_URL}/tilmeld/bekraeft#t=${token}`;
        await sendTransientMail({
          to: email,
          subject: "Bekræft din e-mail til Hello Cal",
          html: `<p>Tryk på linket for at oprette din Hello Cal-konto. Linket virker i 30 minutter.</p><p><a href="${link}">Opret konto</a></p>`,
          devLink: link,
        });
      }
    } else if (active) {
      const token = await createEmailLinkToken("RECOVERY", emailHash);
      const link = `${APP_BASE_URL}/gendan/bekraeft#t=${token}`;
      await sendTransientMail({
        to: email,
        subject: "Gendan adgang til Hello Cal",
        html: `<p>Tryk på linket for at gendanne adgangen til din Hello Cal-konto. Linket virker i 30 minutter.</p><p><a href="${link}">Gendan adgang</a></p>`,
        devLink: link,
      });
    }
  } catch (error) {
    if (error instanceof MailNotConfiguredError) {
      return NextResponse.json({ message: "Mail kan ikke sendes lige nu. Prøv igen senere." }, { status: 503 });
    }
    console.error("Email link failed", error instanceof Error ? error.message : "ukendt");
    return NextResponse.json({ message: "Mail kunne ikke sendes. Prøv igen senere." }, { status: 502 });
  }

  return NextResponse.json(GENERIC);
}
