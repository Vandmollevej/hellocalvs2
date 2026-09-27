import { ensureUmamiWebsite, umamiBaseUrl } from "@/lib/umami";

// Sender sporingsscriptets hændelser videre til den interne Umami
// (docs/DECISIONS.md 2026-09-27 "Umami-analyse"). Klientens IP (fra
// Cloudflare) og browseroplysninger sendes med, så Umami kan beregne land,
// enhed og unikke besøgende; Umami gemmer ikke selve IP-adressen.
const FORWARDED_HEADERS = [
  "content-type",
  "user-agent",
  "accept-language",
  "cf-connecting-ip",
  "cf-ipcountry",
  "x-forwarded-for",
  "x-real-ip",
  "x-umami-cache",
];

// Fejler oprettelsen af websitet (fx forkert Umami-kode), prøves der
// først igen efter fem minutter, så ikke hver hændelse giver et login-forsøg.
let lastEnsureFailure = 0;

export async function POST(request: Request) {
  if (Date.now() - lastEnsureFailure > 300_000) {
    try {
      await ensureUmamiWebsite();
    } catch {
      lastEnsureFailure = Date.now();
    }
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const res = await fetch(`${umamiBaseUrl()}/api/send`, {
      method: "POST",
      headers,
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Analyse må aldrig give fejl i appen.
    return Response.json({ ok: false }, { status: 202 });
  }
}
