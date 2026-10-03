// SMS via TeamMessage (teammessage.eu, docs/DECISIONS.md 2026-10-02 "SMS-
// gendannelse af adgangskode"). REST API: POST /api/v1/sms/send/ med
// Bearer-token. Uden TEAMMESSAGE_API_TOKEN sendes intet (samme no-op-mønster
// som mailer/push), og kaldet returnerer { sent: false }.
//
// Feltnavnene følger TeamMessages REST-dokumentation (team_id,
// teamlist_email, message, to_mobile). TEAMMESSAGE_API_URL kan overskrive
// adressen, hvis kontoen ligger på en anden endpoint.

const DEFAULT_API_URL = "https://www.teammessage.eu/api/v1/sms/send/";
const TIMEOUT_MS = 10_000;

const env = (key: string) => process.env[key]?.trim() || "";

export function smsConfigured() {
  return Boolean(env("TEAMMESSAGE_API_TOKEN"));
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

// Viser kun de sidste to cifre, fx "+45 •• •• •• 12".
export function maskPhone(phone: string) {
  return `${phone.slice(0, 3)} •• •• •• ${phone.slice(-2)}`;
}

export type SmsResult = { sent: boolean; error?: string };

export async function sendSms(toPhone: string, message: string): Promise<SmsResult> {
  const token = env("TEAMMESSAGE_API_TOKEN");
  if (!token) return { sent: false, error: "TEAMMESSAGE_API_TOKEN mangler" };

  const body: Record<string, string> = {
    // TeamMessage forventer nummeret uden "+".
    to_mobile: toPhone.replace(/^\+/, ""),
    message,
  };
  if (env("TEAMMESSAGE_TEAM_ID")) body.team_id = env("TEAMMESSAGE_TEAM_ID");
  if (env("TEAMMESSAGE_TEAMLIST_EMAIL")) body.teamlist_email = env("TEAMMESSAGE_TEAMLIST_EMAIL");
  if (env("TEAMMESSAGE_SENDER")) body.sender = env("TEAMMESSAGE_SENDER");

  try {
    const res = await fetch(env("TEAMMESSAGE_API_URL") || DEFAULT_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      console.error("[sms] TeamMessage afviste beskeden", res.status, text);
      return { sent: false, error: `TeamMessage svarede ${res.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("[sms] TeamMessage kunne ikke kaldes", error);
    return { sent: false, error: error instanceof Error ? error.message : "ukendt fejl" };
  }
}
