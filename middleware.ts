import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-auth";

// Dedicated admin hostname (docs/DEPLOYMENT.md). One codebase, one
// deployment — this host just gets every path treated as living under
// /admin, so visiting the bare hostname shows the admin UI. Localhost is
// included so /admin works during local development without a special host.
const ADMIN_HOST = "products.hellocal.packroff.dk";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/verify", "/admin/setup"];
const PUBLIC_ADMIN_API_PATHS = ["/api/admin/login", "/api/admin/verify", "/api/admin/setup"];

function isPublicPath(pathname: string, publicPaths: string[]) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0] ?? "";
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
