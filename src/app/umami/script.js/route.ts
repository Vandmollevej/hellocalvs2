import { umamiBaseUrl } from "@/lib/umami";

// Umamis sporingsscript leveres fra appens eget domæne (docs/DECISIONS.md
// 2026-09-27 "Umami-analyse"), fordi Umami-containeren ikke er udstillet.
// Scriptet holdes i hukommelsen en time, så ikke hver sidevisning rammer Umami.
let cached: { body: string; at: number } | null = null;
const TTL_MS = 3600_000;

export async function GET() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    try {
      const res = await fetch(`${umamiBaseUrl()}/script.js`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
      if (res.ok) cached = { body: await res.text(), at: Date.now() };
    } catch {
      // Umami nede — tomt script nedenfor, så appen ikke påvirkes.
    }
  }
  return new Response(cached?.body ?? "", {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": cached ? "public, max-age=3600" : "no-store",
    },
  });
}
