import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionInfo } from "@/lib/admin-auth";
import { SCAN_SESSION_COOKIE, verifyScanSession } from "@/lib/scan/auth";
import { PARTNER_SESSION_COOKIE, verifyPartnerSession } from "@/lib/partner/auth";
import { USER_SESSION_COOKIE, verifyUserSession } from "@/lib/user-auth";
import {
  isAnonymousAllowed,
  isBlockedUserAgent,
  isImageRequestAllowed,
  isProtectedImagePath,
  isPublicStaticAsset,
  isPublicHealthPath,
  isTokenApiPath,
  throttle,
} from "@/lib/access-wall";

// Dedicated admin hostname (docs/DEPLOYMENT.md). One codebase, one
// deployment — this host just gets every path treated as living under
// /admin, so visiting the bare hostname shows the admin UI. Localhost is
// included so /admin works during local development without a special host.
// The old packroff.dk admin hostname keeps working during the move to
// hellocal.io (docs/DECISIONS.md 2026-09-27 "Domæne hellocal.io").
const ADMIN_HOSTS = new Set(["admin.hellocal.io", "adminhellocal.packroff.dk"]);

const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/verify",
  "/admin/setup",
  // Login-frit mail-godkendelseslink (docs/DECISIONS.md 2026-09-02):
  // sikkerheden kommer fra det unikke, uigætlige token i URL'en, ikke fra
  // en admin-session — se src/app/admin/approve/[token]/page.tsx.
  "/admin/approve",
  // Admin-brugere (docs/DECISIONS.md 2026-09-29): invitation og godkendelse af
  // ny enhed sker før login; sikret af engangstoken i mail-linket.
  "/admin/invite",
  "/admin/login-approval",
  // Glemt adgangskode: sker per definition uden session; nulstillingen
  // sikres af engangstokenet i mail-linket.
  "/admin/forgot-password",
  "/admin/reset-password",
];
const PUBLIC_ADMIN_API_PATHS = [
  "/api/admin/login",
  "/api/admin/verify",
  "/api/admin/setup",
  // Discoverable/usernameless passkey login (docs/DECISIONS.md 2026-08-28) —
  // by definition happens before there is any session.
  "/api/admin/passkey/authenticate",
  "/api/admin/approve",
  "/api/admin/invite",
  "/api/admin/login-approval",
  "/api/admin/forgot-password",
  "/api/admin/reset-password",
];

// Selv med læseadgang må man logge ud, skifte sprog og administrere egne passkeys.
const READ_ONLY_WRITE_EXCEPTIONS = ["/api/admin/logout", "/api/admin/locale", "/api/admin/passkey"];

// Admin IP-spærre (docs/DECISIONS.md 2026-09-27): /admin og /api/admin kan
// kun nås fra det lokale netværk og fra IP'erne i ADMIN_ALLOWED_IPS
// (kommasepareret). Login kræves stadig. Offentlig trafik kommer via
// Cloudflare-tunnelen, som selv sætter CF-Connecting-IP (klientens egen værdi
// overskrives). Uden den header er forbindelsen direkte på LAN'et.
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i;

function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? "";
}

function isAdminIpAllowed(req: NextRequest): boolean {
  const allowed = (process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  // Ingen liste sat = ingen spærre (undgår at låse admin ude ved fejlopsætning).
  if (allowed.length === 0) return true;

  const ip = clientIp(req).replace(/^::ffff:/, "");
  const isLan = !req.headers.get("cf-connecting-ip") && (ip === "" || PRIVATE_IP.test(ip));
  return isLan || PRIVATE_IP.test(ip) || allowed.includes(ip);
}

function isPublicPath(pathname: string, publicPaths: string[]) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Oprettelses-appen (docs/OPRETTELSES-APP.md) kører som sin egen container
// fra samme image med HELLOCAL_APP_MODE=scan. Dér findes KUN medarbejder-
// ruterne (+ de delte AI-/produkt-API'er som "Opret vare" genbruger); i den
// almindelige app findes /scan slet ikke (undtagen på localhost til udvikling).
const IS_SCAN_APP = process.env.HELLOCAL_APP_MODE === "scan";
const PUBLIC_SCAN_PATHS = ["/scan/login", "/scan/verify", "/scan/setup"];
const PUBLIC_SCAN_API_PATHS = ["/api/scan/login", "/api/scan/verify", "/api/scan/setup", "/api/scan/passkey/authenticate"];
const SCAN_APP_SHARED_PATHS = ["/api/ai", "/api/products/lookup", "/api/health", "/product-images", "/manifest.webmanifest"];

async function handleScan(req: NextRequest, host: string) {
  const url = req.nextUrl.clone();
  let pathname = url.pathname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";

  if (IS_SCAN_APP) {
    if (pathname === "/") pathname = "/scan";
    const isStaticAsset = /\.(png|jpe?g|svg|webp|ico|woff2?)$/i.test(pathname);
    if (!pathname.startsWith("/scan") && !pathname.startsWith("/api/scan") && !isStaticAsset && !isPublicPath(pathname, SCAN_APP_SHARED_PATHS)) {
      return new NextResponse("Not found", { status: 404 });
    }
  } else if ((pathname.startsWith("/scan") || pathname.startsWith("/api/scan")) && !isLocalhost) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isScanPage = pathname === "/scan" || pathname.startsWith("/scan/");
  const isScanApi = pathname.startsWith("/api/scan/");
  if (isScanPage || isScanApi) {
    const isPublic = isScanPage ? isPublicPath(pathname, PUBLIC_SCAN_PATHS) : isPublicPath(pathname, PUBLIC_SCAN_API_PATHS);
    if (!isPublic) {
      const token = req.cookies.get(SCAN_SESSION_COOKIE)?.value;
      const workerId = token ? await verifyScanSession(token) : null;
      if (!workerId) {
        if (isScanApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        const login = url.clone();
        login.pathname = "/scan/login";
        return NextResponse.redirect(login);
      }
    }
  }

  if (pathname !== url.pathname) {
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  }
  return null;
}

// Partnerportalen (docs/DECISIONS.md 2026-10-02): B2B-brugere logger ind på
// det offentlige domæne under /partner. Login og invitationslink er åbne;
// alt andet kræver partnersessionen. requirePartnerUser() tjekker desuden i
// databasen, at brugeren stadig er aktiv.
const PUBLIC_PARTNER_PATHS = ["/partner/login", "/partner/verify", "/partner/invite"];
const PUBLIC_PARTNER_API_PATHS = ["/api/partner/login", "/api/partner/verify", "/api/partner/invite"];

async function handlePartner(req: NextRequest, host: string) {
  // Portalen findes kun på det offentlige domæne; admin-værten omskriver alle stier til /admin.
  if (ADMIN_HOSTS.has(host)) return null;
  const pathname = req.nextUrl.pathname;
  const isPage = pathname === "/partner" || pathname.startsWith("/partner/");
  const isApi = pathname.startsWith("/api/partner/");
  if (!isPage && !isApi) return null;
  if (isPublicPath(pathname, isPage ? PUBLIC_PARTNER_PATHS : PUBLIC_PARTNER_API_PATHS)) return null;

  const token = req.cookies.get(PARTNER_SESSION_COOKIE)?.value;
  const session = token ? await verifyPartnerSession(token) : null;
  if (session) return null;
  if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const login = req.nextUrl.clone();
  login.pathname = "/partner/login";
  login.search = "";
  return NextResponse.redirect(login);
}

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex" };

function deny(status: number, body: string, extra: Record<string, string> = {}) {
  return new NextResponse(body, { status, headers: { ...NOINDEX, "Cache-Control": "no-store", ...extra } });
}

// Adgangsmur (docs/DECISIONS.md 2026-10-08): kun forsiden + login/juridiske sider
// er åbne for anonyme. Alt andet — sider, API'er og beskyttede billeder —
// kræver en gyldig brugersession. Kendte crawlere/scrapere afvises helt.
async function handleAccessWall(req: NextRequest, host: string): Promise<NextResponse | null> {
  const url = req.nextUrl;
  let pathname = url.pathname;
  if (isPublicHealthPath(pathname)) return null;

  // Next's billed-optimerer: afgør ud fra den ægte kilde, ikke /_next/image.
  const isOptimizer = pathname === "/_next/image";
  if (isOptimizer) {
    const src = url.searchParams.get("url") ?? "";
    pathname = src.startsWith("/") && !src.startsWith("//") ? src.split("?")[0] : "/_next/image-invalid";
    if (pathname === "/_next/image-invalid") return deny(400, "Bad request");
  }

  // Åbne statiske filer (ikoner, flag, logoer) er ikke hemmelige og skal altid
  // kunne hentes — også af Next's billed-optimerer, som henter filen internt
  // uden browserens User-Agent. Før blev den afvist som "bot", og alle PNG/WebP-
  // ikoner (fingeraftryk, tilføj-ikoner) forsvandt.
  if (isPublicStaticAsset(pathname)) return null;

  const isLocal = host === "localhost" || host === "127.0.0.1";
  const ua = req.headers.get("user-agent");
  const ip = clientIp(req) || "unknown";

  // Crawlere, AI-scrapere og script-klienter afvises overalt — også på forsiden.
  // robots.txt serveres altid, så pæne bots kan læse "Disallow: /". Enheds-/agent-
  // API'er med eget token er ikke browsere og undtages.
  if (pathname !== "/robots.txt" && !isLocal && !isTokenApiPath(pathname) && isBlockedUserAgent(ua)) {
    return deny(403, "Forbidden");
  }
  if (pathname === "/robots.txt") return null;
  // Partnerportalen har sin egen session; handlePartner() har allerede afvist
  // anonyme, så her skal vi kun have stoppet bots (ovenfor).
  if (pathname === "/partner" || pathname.startsWith("/partner/") || pathname.startsWith("/api/partner/")) {
    return null;
  }

  const token = req.cookies.get(USER_SESSION_COOKIE)?.value;
  const session = token ? await verifyUserSession(token) : null;
  const isApi = pathname.startsWith("/api/");
  const isImage = isProtectedImagePath(pathname);

  if (!session) {
    // Token-API'er (widgets, MCP, HealthKit) validerer selv deres Bearer/URL-token.
    if (!isAnonymousAllowed(pathname)) {
      if (isApi) return deny(401, JSON.stringify({ error: "unauthorized" }), { "Content-Type": "application/json" });
      if (isImage) return deny(404, "Not found");
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
    // Anonyme har en lav hastighedsgrænse (forside/login).
    const wait = throttle(ip, isApi ? "api" : "anon");
    if (wait) return deny(429, "Too many requests", { "Retry-After": String(wait) });
    return null;
  }

  if (isImage) {
    if (!isImageRequestAllowed(req.headers, req.headers.get("host") ?? host)) return deny(403, "Forbidden");
    const wait = throttle(session.userId, "image");
    if (wait) return deny(429, "Too many requests", { "Retry-After": String(wait) });
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, max-age=3600");
    res.headers.set("Vary", "Cookie");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    return res;
  }

  const wait = throttle(session.userId, isApi ? "api" : "auth");
  if (wait) return deny(429, "Too many requests", { "Retry-After": String(wait) });
  return null;
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";
  const scanResult = await handleScan(req, host);
  if (scanResult) return scanResult;
  if (IS_SCAN_APP) return NextResponse.next();
  const partnerResult = await handlePartner(req, host);
  if (partnerResult) return partnerResult;
  const isAdminHost = ADMIN_HOSTS.has(host);
  // Localhost is only exempted from the hostname *gate* below (so /admin/*
  // is reachable during local development); it does not get the root-path
  // rewrite, since that would hijack the whole app in local dev.
  const isAdminAllowedHost = isAdminHost || host === "localhost" || host === "127.0.0.1";

  const url = req.nextUrl.clone();
  let pathname = url.pathname;

  // Adgangsmuren gælder forbrugerdomænet; admin-værten og /admin-ruterne har
  // deres egen (strengere) login- og IP-spærre længere nede.
  if (!isAdminHost && !pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    const wall = await handleAccessWall(req, host);
    if (wall) return wall;
  }

  // Metadata files (icon.png, apple-icon.png, manifest.webmanifest, /icons/*)
  // live at the root; prefixing them with /admin would 404 and leave the
  // browser on the low-res favicon.ico only.
  const isRootAsset =
    /\.(png|jpe?g|svg|webp|ico|woff2?|webmanifest)$/i.test(pathname) || pathname.startsWith("/icons/");
  if (isAdminHost && !isRootAsset && !pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  if (!isAdminIpAllowed(req)) {
    return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  }

  // The admin UI only exists on its dedicated hostname — refuse it on the
  // public consumer domain even though every route is also login-gated.
  if (!isAdminAllowedHost) {
    return isAdminApi
      ? NextResponse.json({ error: "not_found" }, { status: 404 })
      : new NextResponse("Not found", { status: 404 });
  }

  const isPublic = isAdminPage
    ? isPublicPath(pathname, PUBLIC_ADMIN_PATHS)
    : isPublicPath(pathname, PUBLIC_ADMIN_API_PATHS);

  if (!isPublic) {
    const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSessionInfo(token) : null;
    if (!session) {
      if (isAdminApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      const login = url.clone();
      login.pathname = "/admin/login";
      return NextResponse.redirect(login);
    }
    // Læseadgang (docs/DECISIONS.md 2026-09-29): ingen skrivninger. Server
    // actions er POST til sidens egen sti, så alt andet end GET/HEAD afvises.
    // requireAdminUser() tjekker desuden niveauet i databasen.
    const isRead = req.method === "GET" || req.method === "HEAD";
    if (session.level === "READ" && !isRead && !isPublicPath(pathname, READ_ONLY_WRITE_EXCEPTIONS)) {
      return isAdminApi
        ? NextResponse.json({ error: "read_only" }, { status: 403 })
        : new NextResponse("Kun læseadgang", { status: 403 });
    }
  }

  if (pathname !== url.pathname) {
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};
