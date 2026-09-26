"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Private sider kræver login. Uden session sendes brugeren til velkomst-
// siden; efter login kommer de tilbage via ?next=.
const PUBLIC_PREFIXES = [
  "/welcome",
  "/velkommen",
  "/login",
  "/logind",
  "/signup",
  "/tilmeld",
  "/forgot-password",
  "/reset-password",
  "/hello-doc",
  "/forward",
  "/betingelser",
  "/admin",
  // Oprettelses-appen har eget medarbejder-login og ingen klient-boks.
  "/scan",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthGate() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (isPublic(pathname)) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => {
        // Kun et klart "ikke logget ind" sender videre; offline/serverfejl gør ikke.
        if (!cancelled && res.status === 401) router.replace("/welcome");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
