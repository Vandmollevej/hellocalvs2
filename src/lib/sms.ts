import { prisma } from "@/lib/prisma";
import { pushSentNotice } from "@/lib/sent-notices";
import type { MessageEvent as MessageEventType } from "@prisma/client";

// Sms-gateway, forberedt men ikke aktiveret (samme mønster som mailer.ts og
// push.ts): uden SMS_GATEWAY_TOKEN er sendSms() en no-op. Formatet er
// GatewayAPI's REST-API (https://gatewayapi.com/docs/apis/rest/); en anden
// udbyder med samme format kan vælges med SMS_GATEWAY_URL.
//
// Telefonnummeret gemmes aldrig — OutboundMessage-rækken logger kun bruger,
// event og emne, så "Til info sendte vi dig ..."-popuppen kan vises.

const DEFAULT_URL = "https://gatewayapi.eu/rest/mtsms";

export function isSmsConfigured() {
  return Boolean(process.env.SMS_GATEWAY_TOKEN);
}

export async function sendSms({
  userId,
  to,
  event,
  subject,
  text,
}: {
  userId?: string;
  /** Internationalt format, fx "4512345678" eller "+45 12 34 56 78". */
  to: string;
  event: MessageEventType;
  /** Kort emne til loggen og popuppen (selve sms-teksten gemmes ikke). */
  subject: string;
  text: string;
}): Promise<{ sent: boolean; skipped?: "sms_not_configured" }> {
  if (!isSmsConfigured()) return { sent: false, skipped: "sms_not_configured" };

  const msisdn = to.replace(/\D/g, "");
  let error: string | null = msisdn ? null : "Ugyldigt telefonnummer";
  if (!error) {
    try {
      const res = await fetch(process.env.SMS_GATEWAY_URL || DEFAULT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${process.env.SMS_GATEWAY_TOKEN}`,
        },
        body: JSON.stringify({
          sender: process.env.SMS_SENDER || "Hello Cal",
          message: text,
          recipients: [{ msisdn: Number(msisdn) }],
        }),
      });
      if (!res.ok) error = `Gateway svarede ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Ukendt fejl";
    }
  }

  await prisma.outboundMessage.create({
    data: {
      userId,
      event,
      channel: "SMS",
      subject,
      status: error ? "FAILED" : "SENT",
      error,
      sentAt: error ? null : new Date(),
    },
  });
  if (!error && userId) void pushSentNotice(userId, "SMS", subject);
  return { sent: !error };
}
