// TeamMessage SMS-API (https://www.teammessage.eu/en/documentation/api/).
// POST {base}/api/v1/sms/send/ med Bearer-token. Kun SMS sendes herfra —
// koderne genereres og kontrolleres i src/lib/sms-verification.ts.
//
// Miljøvariabler (TEAMMESSAGE_* først, ellers de generiske navne fra
// env.example): API_TOKEN, TEAM_ID, TEAMLIST_EMAIL, SENDER_EMAIL, API_BASE_URL.

function env(primary: string, fallback: string): string {
  return (process.env[primary] || process.env[fallback] || "").trim();
}

function config() {
  return {
    baseUrl: env("TEAMMESSAGE_API_BASE_URL", "API_BASE_URL") || "https://www.teammessage.de",
    token: env("TEAMMESSAGE_API_TOKEN", "API_TOKEN"),
    teamId: Number(env("TEAMMESSAGE_TEAM_ID", "TEAM_ID")),
    teamlistEmail: env("TEAMMESSAGE_TEAMLIST_EMAIL", "TEAMLIST_EMAIL"),
    senderEmail: env("TEAMMESSAGE_SENDER_EMAIL", "SENDER_EMAIL"),
    // Alfanumerisk afsender (maks. 11 tegn), vises i stedet for et nummer.
    from: (process.env.TEAMMESSAGE_FROM || "HelloCal").slice(0, 11),
    testMode: process.env.TEAMMESSAGE_TEST_MODE === "1",
  };
}

export function isSmsConfigured(): boolean {
  const c = config();
  return Boolean(c.token && Number.isInteger(c.teamId) && c.teamId > 0 && c.teamlistEmail);
}

export type SmsResult = { ok: true } | { ok: false; error: string };

export async function sendSms(toMobile: string, message: string): Promise<SmsResult> {
  const c = config();
  if (!isSmsConfigured()) return { ok: false, error: "TeamMessage er ikke sat op" };

  try {
    const response = await fetch(`${c.baseUrl}/api/v1/sms/send/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({
        team_id: c.teamId,
        teamlist_email: c.teamlistEmail,
        to_mobile: toMobile.replace(/^\+/, ""),
        message,
        from_mobile: c.from,
        ucs2: 1,
        ...(c.senderEmail ? { sender_email: c.senderEmail } : {}),
        ...(c.testMode ? { test: 1 } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { code?: number; message?: string };
    if (response.ok && data.code === 1) return { ok: true };
    // Koden må aldrig ligge i loggen; kun TeamMessage-fejlkoden.
    console.error("TeamMessage SMS failed", { status: response.status, code: data.code, message: data.message });
    return { ok: false, error: data.message ?? `HTTP ${response.status}` };
  } catch (error) {
    console.error("TeamMessage SMS request failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "Kunne ikke nå TeamMessage" };
  }
}
