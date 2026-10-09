// Adgangsmur mod crawlere, scrapere og anonym trafik (docs/DECISIONS.md
// 2026-10-08 "Adgangsmur"). Kun forsiden og login-/juridiske sider er åbne for
// anonyme; alt andet — sider, API'er og produkt-/opskriftsbilleder — kræver en
// gyldig brugersession. Ren, edge-sikker logik (ingen Node-API'er), så den kan
// bruges direkte fra middleware.ts og testes isoleret.

// Kendte crawlere, AI-scrapere, SEO-værktøjer og script-klienter. Matches
// case-insensitivt mod User-Agent. Bevidst bred: en rigtig browser indeholder
// aldrig disse strenge.
const BLOCKED_UA = new RegExp(
  [
    // AI-træning / AI-søgning
    "gptbot", "chatgpt", "oai-searchbot", "openai", "claudebot", "claude-web", "anthropic",
    "ccbot", "bytespider", "bytedance", "amazonbot", "applebot", "perplexity", "cohere",
    "diffbot", "google-extended", "googleother", "meta-externalagent", "facebookbot",
    "facebookexternalhit", "imagesiftbot", "omgili", "timpibot", "youbot", "ai2bot",
    "petalbot", "friendlycrawler", "img2dataset", "laion",
    // Søgemaskiner (forsiden har noindex; de skal ikke hente resten)
    "googlebot", "bingbot", "bingpreview", "duckduckbot", "yandex", "baiduspider",
    "sogou", "seznambot", "slurp", "ia_archiver", "archive\\.org_bot",
    // SEO / overvågning / scraping-værktøjer
    "semrush", "ahrefs", "mj12bot", "dotbot", "rogerbot", "screaming frog", "blexbot",
    "dataforseo", "serpstat", "megaindex", "zoominfo", "scrapy", "scrapingbot",
    "httrack", "webcopier", "teleport", "nutch", "heritrix", "apify", "crawlee",
    // Script-/headless-klienter
    "python-requests", "python-urllib", "python-httpx", "aiohttp", "httpx", "urllib",
    "curl/", "wget", "libwww", "go-http-client", "java/", "apache-httpclient",
    "node-fetch", "axios", "undici", "got \\(", "postmanruntime", "insomnia", "okhttp-scrape",
    "headlesschrome", "phantomjs", "puppeteer", "playwright", "selenium", "webdriver",
    "lighthouse",
    // Generiske ord
    "bot[/ ;)-]", "bot$", "crawl", "spider", "scrap", "fetcher",
  ].join("|"),
  "i"
);

export function isBlockedUserAgent(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true; // rigtige browsere har lange UA'er
  return BLOCKED_UA.test(userAgent);
}

// ---- Hvad er åbent for anonyme? -------------------------------------------

// Sider uden login. Forsiden viser "hent appen"; resten er login-flowet,
// juridiske sider og token-beskyttede delingslinks.
const PUBLIC_PAGE_EXACT = new Set(["/", "/robots.txt", "/manifest.webmanifest", "/sitemap.xml", "/sw.js"]);
const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/signup",
  "/welcome",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/betingelser",
  "/privatlivspolitik",
  "/om-os",
  "/business", // B2B-forside med kontaktformular
  "/presse",
  "/forward", // /forward/[token] — uigætteligt engangstoken
  "/hello-doc", // /hello-doc/[token] — lægedeling, token
  "/family-code", // barn indløser familiekode før login
  "/umami", // egen statistik (script + send)
];

// API'er der ikke kan bære en cookie (login, callbacks, webhooks, sundhedstjek).
// Hver rute validerer selv sit hemmelige token/signatur.
const PUBLIC_API_PREFIXES = [
  "/api/auth", // login, registrering, OAuth, passkeys, glemt kode
  "/api/health", // Docker-healthcheck
  "/api/payments/mobilepay/webhook",
  "/api/payments/stripe/webhook",
  "/api/withings/callback",
  "/api/google-health/callback",
  "/api/integrations", // OAuth-callbacks; cookie-tjek sker i ruterne
  "/api/family/claim",
  "/api/business-contact", // kontaktformularen på /business
];

// API'er med eget Bearer-/URL-token (enheder, widgets, agenter). De må ikke
// afvises som bots, fordi klienterne ikke er browsere.
const TOKEN_API_PREFIXES = ["/api/widgets/snapshot", "/api/mcp/", "/api/integrations/healthkit/"];

// Statiske filer, der skal kunne vises på de åbne sider (logo, ikoner, flag).
const PUBLIC_STATIC_PREFIXES = [
  "/icons",
  "/flags",
  "/integrations",
  "/payment",
  "/certifications",
  "/hello-cal-logo",
  "/hello-cal-fruit",
  "/icon",
  "/apple-icon",
  "/favicon",
  "/flag-",
];

// Beskyttede billeder: produkter, opskrifter, mærkelogoer, dummy-/målebilleder.
// Kræver login, må ikke hotlinkes og må ikke åbnes som selvstændig side.
const PROTECTED_IMAGE_PREFIXES = [
  "/product-images",
  "/hellofresh-images",
  "/brand-logos",
  "/dummy",
  "/body-measurements",
  "/measurements",
  "/icons/animals",
  "/icons/body-measurements",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname.startsWith(p));
}

export function isProtectedImagePath(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_IMAGE_PREFIXES);
}

export function isTokenApiPath(pathname: string): boolean {
  return startsWithAny(pathname, TOKEN_API_PREFIXES);
}

export function isPublicHealthPath(pathname: string): boolean {
  return pathname === "/api/health";
}

// Statiske filer til de åbne sider (ikoner, flag, logoer). Brug ægte
// filendelse, så /icons/... kun åbnes som billede og ikke som side.
export function isPublicStaticAsset(pathname: string): boolean {
  if (isProtectedImagePath(pathname)) return false;
  return (
    /\.(png|jpe?g|svg|webp|ico|woff2?|webmanifest|js|css|txt)$/i.test(pathname) &&
    startsWithAny(pathname, PUBLIC_STATIC_PREFIXES)
  );
}

export function isAnonymousAllowed(pathname: string): boolean {
  if (isProtectedImagePath(pathname)) return false;
  if (PUBLIC_PAGE_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/")) {
    return matchesPrefix(pathname, PUBLIC_API_PREFIXES) || isTokenApiPath(pathname);
  }
  if (matchesPrefix(pathname, PUBLIC_PAGE_PREFIXES)) return true;
  return isPublicStaticAsset(pathname);
}

// ---- Hotlink-/direkte-adgang til beskyttede billeder -----------------------

// Et billede må kun hentes af en side på vores eget domæne. Moderne browsere
// sender Sec-Fetch-*: direkte åbning (Dest=document), indlejring andre steder
// (Site=cross-site) og iframes afvises. Safari/iOS sender ikke altid disse
// headere; dér falder vi tilbage på Referer (skal være vores eget host, hvis
// den findes). Selve adgangsbarrieren er stadig session-cookien.
export function isImageRequestAllowed(headers: Headers, host: string): boolean {
  const site = headers.get("sec-fetch-site");
  const dest = headers.get("sec-fetch-dest");
  if (site) {
    if (site !== "same-origin" && site !== "same-site") return false;
    return !dest || dest === "image" || dest === "style" || dest === "empty";
  }
  const referer = headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

// ---- Rate limit (fast vindue, pr. IP, i processen) ------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateClass = "anon" | "auth" | "image" | "api";

const LIMITS: Record<RateClass, { max: number; windowMs: number }> = {
  anon: { max: 60, windowMs: 60_000 }, // anonym: forside/login
  auth: { max: 600, windowMs: 60_000 }, // sider for loggede-ind
  image: { max: 900, windowMs: 60_000 }, // billeder: sider kan hente mange ad gangen
  api: { max: 300, windowMs: 60_000 },
};

// Returnerer antal sekunder til næste forsøg, hvis grænsen er nået; ellers 0.
export function throttle(key: string, cls: RateClass, now = Date.now()): number {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const { max, windowMs } = LIMITS[cls];
  const id = `${cls}:${key}`;
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  bucket.count += 1;
  return bucket.count > max ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
}
