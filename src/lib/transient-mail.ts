import nodemailer from "nodemailer";

// docs/PRIVACY.md "Login og e-mail": mails til almindelige brugere sendes
// direkte til den adresse, brugeren netop har tastet, og adressen gemmes
// ALDRIG — heller ikke i OutboundMessage-køen (src/lib/mailer.ts), som
// ellers ville ligge med klartekst-adressen til den blev sendt.
//
// Uden SMTP i produktion kan mailen ikke sendes, og kaldet fejler. I
// udvikling skrives linket i serverkonsollen, så flowet kan testes lokalt.

export class MailNotConfiguredError extends Error {}

export const APP_BASE_URL = process.env.APP_BASE_URL || "https://hellocal.packroff.dk";

export async function sendTransientMail({
  to,
  subject,
  html,
  devLink,
}: {
  to: string;
  subject: string;
  html: string;
  devLink?: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[transient-mail] SMTP ikke opsat — udviklingslink: ${devLink ?? "(intet link)"}`);
      return;
    }
    throw new MailNotConfiguredError("SMTP er ikke opsat");
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || "Hello Cal <no-reply@hellocal.local>",
    to,
    subject,
    html,
  });
}
