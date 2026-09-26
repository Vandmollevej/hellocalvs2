"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Udtrykkeligt samtykke til helbredsoplysninger (GDPR art. 9, docs/DECISIONS.md
// 2026-09-25). En indlogget bruger uden samtykke (login via Google/Apple/
// Facebook eller konto fra før samtykket) sendes til /samtykke. Juridiske
// sider forbliver læsbare, så brugeren kan se, hvad der gives samtykke til.
const SKIP_PREFIXES = [
  "/samtykke",
  "/betingelser",
  "/privatlivspolitik",
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
  "/admin",
];

export function ConsentGate() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { hasHealthDataConsent?: boolean } } | null) => {
        if (!cancelled && data?.user?.hasHealthDataConsent === false) {
          router.replace(`/samtykke?next=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
