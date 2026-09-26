import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { SCAN_SESSION_COOKIE, verifyScanSession } from "@/lib/scan/auth";

// Dedicated admin hostname (docs/DEPLOYMENT.md). One codebase, one
// deployment — this host just gets every path treated as living under
// /admin, so visiting the bare hostname shows the admin UI. Localhost is
// included so /admin works during local development without a special host.
const ADMIN_HOST = "adminhellocal.packroff.dk";

const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
  "/admin/verify",
  "/admin/setup",
  // Login-frit mail-godkendelseslink (docs/DECISIONS.md 2026-09-02):
  // sikkerheden kommer fra det unikke, uigætlige token i URL'en, ikke fra
  // en admin-session — se src/app/admin/approve/[token]/page.tsx.
  "/admin/approve",
];
const PUBLIC_ADMIN_API_PATHS = [
  "/api/admin/login",
  "/api/admin/verify",
  "/api/admin/setup",
  // Discoverable/usernameless passkey login (docs/DECISIONS.md 2026-08-28) —
  // by definition happens before there is any session.
  "/api/admin/passkey/authenticate",
  "/api/admin/approve",
];

function isPublicPath(pathname: string, publicPaths: string[]) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Oprettelses-appen (docs/OPRETTELSES-APP.md) kører som sin egen container
// fra samme image med HELLOCAL_APP_MODE=scan. Dér findes KUN medarbejder-
// ruterne (+ de delte AI-/produkt-API'er som "Opret vare" genbruger); i den
// almindelige app findes /scan slet ikke (undtagen på localhost til udvikling).
const IS_SCAN_APP = process.env.HELLOCAL_APP_MODE === "scan";
const PUBLIC_SCAN_PATHS = ["/scan/login", "/scan/verify", "/scan/setup"];
const PUBLIC_SCAN_API_PATHS = ["/api/scan/login", "/api/scan/verify", "/api/scan/setup"];
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

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";
  const scanResult = await handleScan(req, host);
  if (scanResult) return scanResult;
  if (IS_SCAN_APP) return NextResponse.next();
  const isAdminHost = host === ADMIN_HOST;
  // Localhost is only exempted from the hostname *gate* below (so /admin/*
  // is reachable during local development); it does not get the root-path
  // rewrite, since that would hijack the whole app in local dev.
  const isAdminAllowedHost = isAdminHost || host === "localhost" || host === "127.0.0.1";

  const url = req.nextUrl.clone();
  let pathname = url.pathname;

  if (isAdminHost && !pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

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
    const userId = token ? await verifyAdminSession(token) : null;
    if (!userId) {
      if (isAdminApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      const login = url.clone();
      login.pathname = "/admin/login";
      return NextResponse.redirect(login);
    }
  }

  if (pathname !== url.pathname) {
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
