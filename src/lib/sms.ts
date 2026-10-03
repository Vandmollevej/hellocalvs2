import { prisma } from "@/lib/prisma";
import { pushSentNotice } from "@/lib/sent-notices";
import { isSmsConfigured as isTeamMessageConfigured, sendSms as sendViaTeamMessageApi } from "@/lib/teammessage";
import type { MessageEvent as MessageEventType } from "@prisma/client";

// SMS med logning (OutboundMessage). Udbyder: TeamMessage (src/lib/teammessage.ts)
// hvis den er sat op, ellers GatewayAPI (SMS_GATEWAY_TOKEN) som reserve.
// Uden nogen noegler er sendSms() en no-op (samme moenster som mailer/push).
// Telefonnummeret og sms-teksten gemmes aldrig i loggen.

const GATEWAYAPI_URL = "https://gatewayapi.eu/rest/mtsms";
const TIMEOUT_MS = 10_000;

const env = (key: string) => process.env[key]?.trim() || "";

export function isSmsConfigured() {
  return isTeamMessageConfigured() || Boolean(env("SMS_GATEWAY_TOKEN"));
}

async function sendViaTeamMessage(to: string, text: string) {
  const result = await sendViaTeamMessageApi(to, text);
  return result.ok ? null : `TeamMessage: ${result.error}`;
}

async function sendViaGatewayApi(msisdn: string, text: string) {
  const res = await fetch(env("SMS_GATEWAY_URL") || GATEWAYAPI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${env("SMS_GATEWAY_TOKEN")}` },
    body: JSON.stringify({
      sender: env("SMS_SENDER") || "Hello Cal",
      message: text,
      recipients: [{ msisdn: Number(msisdn) }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res.ok ? null : `Gateway svarede ${res.status}`;
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
      error = isTeamMessageConfigured()
        ? await sendViaTeamMessage(`+${msisdn}`, text)
        : await sendViaGatewayApi(msisdn, text);
    } catch (err) {
      console.error("[sms] afsendelse fejlede", err);
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
