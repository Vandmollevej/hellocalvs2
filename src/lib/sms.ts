import { prisma } from "@/lib/prisma";
import { pushSentNotice } from "@/lib/sent-notices";
import type { MessageEvent as MessageEventType } from "@prisma/client";

// SMS-afsendelse (docs/DECISIONS.md 2026-10-02 "SMS-gendannelse af
// adgangskode"). Udbyder: TeamMessage (teammessage.eu), REST
// POST /api/v1/sms/send/ med Bearer-token. Er TeamMessage ikke sat op, men
// SMS_GATEWAY_TOKEN er, bruges GatewayAPI's format (den tidligere forberedte
// reserve). Uden nøgler er sendSms() en no-op (samme mønster som mailer/push).
//
// Telefonnummeret og sms-teksten gemmes aldrig i loggen — OutboundMessage-
// rækken har kun bruger, event og emne, så "Til info sendte vi dig ..."-
// popuppen kan vises.

const TEAMMESSAGE_URL = "https://www.teammessage.eu/api/v1/sms/send/";
const GATEWAYAPI_URL = "https://gatewayapi.eu/rest/mtsms";
const TIMEOUT_MS = 10_000;

const env = (key: string) => process.env[key]?.trim() || "";

export function isSmsConfigured() {
  return Boolean(env("TEAMMESSAGE_API_TOKEN") || env("SMS_GATEWAY_TOKEN"));
}

// Danske numre normaliseres til +45XXXXXXXX. Andre numre skal angives med
// landekode (+ eller 00). Returnerer null for noget, der ikke ligner et nummer.
export function normalizePhone(input: string): string | null {
  const raw = input.replace(/[\s\-().]/g, "");
  if (!raw) return null;
  let digits: string;
  if (raw.startsWith("+")) digits = raw.slice(1);
  else if (raw.startsWith("00")) digits = raw.slice(2);
  else if (/^\d{8}$/.test(raw)) digits = `45${raw}`;
  else return null;
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith("45") && digits.length !== 10) return null;
  return `+${digits}`;
}

// Feltnavnene følger TeamMessages REST-dokumentation (to_mobile, message,
// team_id, teamlist_email). TEAMMESSAGE_API_URL kan overskrive adressen.
async function sendViaTeamMessage(msisdn: string, text: string) {
  const body: Record<string, string> = { to_mobile: msisdn, message: text };
  if (env("TEAMMESSAGE_TEAM_ID")) body.team_id = env("TEAMMESSAGE_TEAM_ID");
  if (env("TEAMMESSAGE_TEAMLIST_EMAIL")) body.teamlist_email = env("TEAMMESSAGE_TEAMLIST_EMAIL");
  if (env("TEAMMESSAGE_SENDER")) body.sender = env("TEAMMESSAGE_SENDER");
  const res = await fetch(env("TEAMMESSAGE_API_URL") || TEAMMESSAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("TEAMMESSAGE_API_TOKEN")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[sms] TeamMessage afviste beskeden", res.status, (await res.text()).slice(0, 300));
    return `TeamMessage svarede ${res.status}`;
  }
  return null;
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
      error = env("TEAMMESSAGE_API_TOKEN")
        ? await sendViaTeamMessage(msisdn, text)
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
