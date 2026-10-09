import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Henter hovedbilledet (og:image) fra den kildeside, brugeren indsatte en
// opskrift fra, så retten får et billede øverst automatisk (brugerens krav
// 2026-10-07). Kun offentlige http(s)-adresser; aldrig lokale/private
// netværk. Returnerer en data-URL (maks. 1,5 MB) eller null.

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 6000;

function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function isPublicHost(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) return false;
  if (isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const records = await lookup(hostname, { all: true });
    return records.length > 0 && records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
}

async function guardedFetch(url: URL, accept: string) {
  if (!["http:", "https:"].includes(url.protocol) || !(await isPublicHost(url.hostname))) return null;
  const res = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "HelloCalBot/1.0" },
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  return res?.ok ? res : null;
}

export async function fetchSourceImage(sourceUrl: string): Promise<string | null> {
  let page: URL;
  try {
    page = new URL(sourceUrl);
  } catch {
    return null;
  }
  const pageRes = await guardedFetch(page, "text/html");
  if (!pageRes) return null;
  const html = (await pageRes.text()).slice(0, 400_000);
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!match) return null;
  let imageUrl: URL;
  try {
    imageUrl = new URL(match[1].replace(/&amp;/g, "&"), page);
  } catch {
    return null;
  }
  const imageRes = await guardedFetch(imageUrl, "image/*");
  const type = imageRes?.headers.get("content-type") ?? "";
  if (!imageRes || !/^image\/(jpeg|png|webp)/.test(type)) return null;
  const bytes = Buffer.from(await imageRes.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
  return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
}
