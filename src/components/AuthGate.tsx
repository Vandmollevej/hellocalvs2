"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EmailVerifySheet } from "@/components/EmailVerifySheet";

// Private sider kræver login. Uden session sendes brugeren til velkomst-
// siden; efter login kommer de tilbage via ?next=.
// Indloggede uden telefonnummer (fx oprettet med Google/Apple/Facebook eller
// før nummeret blev obligatorisk) sendes til /account/phone, til det er
// udfyldt (docs/DECISIONS.md 2026-10-02).
const PHONE_PATH = "/account/phone";

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
  // Offentlige sider fra forsidens footer (docs/DECISIONS.md 2026-09-29).
  "/business",
  "/presse",
  // Partnerportalen har eget B2B-login (docs/DECISIONS.md 2026-10-02).
  "/partner",
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
        // Forsiden viser selv den offentlige hent-appen-side uden login.
        if (!cancelled && res.status === 401 && pathname !== "/") router.replace("/welcome");
        return res.ok ? res.json() : null;
      })
      .then((data: { user?: { emailVerified?: boolean; phoneRequired?: boolean } } | null) => {
        if (cancelled || !data?.user) return;
        setEmailUnverified(data.user.emailVerified === false);
        if (data.user.phoneRequired && pathname !== PHONE_PATH) {
          router.replace(`${PHONE_PATH}?next=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return emailUnverified && !isPublicPath(pathname) ? <EmailVerifySheet /> : null;
}
