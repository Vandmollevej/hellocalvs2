import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Admin IP-spærre: /admin og /api/admin kan kun nås fra det lokale netværk
// og fra IP'erne i ADMIN_ALLOWED_IPS (kommasepareret). Login kræves stadig.
// Offentlig trafik kommer via Cloudflare-tunnelen, som selv sætter
// CF-Connecting-IP (klientens egen værdi overskrives). Uden den header er
// forbindelsen direkte på LAN'et.

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

export function proxy(req: NextRequest) {
  const allowed = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  // Ingen liste sat = ingen spærre (undgår at låse admin ude ved fejlopsætning).
  if (allowed.length === 0) return NextResponse.next();

  const ip = clientIp(req).replace(/^::ffff:/, "");
  const isLan = !req.headers.get("cf-connecting-ip") && (ip === "" || PRIVATE_IP.test(ip));
  if (isLan || PRIVATE_IP.test(ip) || allowed.includes(ip)) return NextResponse.next();

  return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
