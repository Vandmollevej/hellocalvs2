"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EmailVerifyBanner } from "@/components/EmailVerifyBanner";

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
  "/verify-email",
  "/hello-doc",
  "/forward",
  "/betingelser",
  "/privatlivspolitik",
  "/admin",
  // Familiemedlem sætter sit eget login med en kode fra betaleren (docs/FAMILY.md).
  "/family-code",
  // Oprettelses-appen har eget medarbejder-login og ingen klient-boks.
  "/scan",
];

export function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthGate() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [emailUnverified, setEmailUnverified] = useState(false);

  useEffect(() => {
    if (isPublicPath(pathname)) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => {
        // Kun et klart "ikke logget ind" sender videre; offline/serverfejl gør ikke.
        if (!cancelled && res.status === 401) router.replace("/welcome");
        return res.ok ? res.json() : null;
      })
      .then((data: { user?: { emailVerified?: boolean } } | null) => {
        if (!cancelled && data?.user) setEmailUnverified(data.user.emailVerified === false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return emailUnverified && !isPublicPath(pathname) ? <EmailVerifyBanner /> : null;
}
