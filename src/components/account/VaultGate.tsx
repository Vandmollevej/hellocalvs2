"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVault } from "@/lib/vault/store";

// Private sider kræver en åben boks (docs/PRIVACY.md). Der findes ikke
// længere en delt demo-bruger: uden login sendes brugeren til velkomst-
// siden, og mangler nøglen på denne enhed, til gendannelse.
const PUBLIC_PREFIXES = [
  "/welcome",
  "/velkommen",
  "/login",
  "/logind",
  "/signup",
  "/tilmeld",
  "/gendan",
  "/hello-doc",
  "/forward",
  "/nyhedsbrev",
  "/betingelser",
  "/admin",
  // Oprettelses-appen har eget medarbejder-login og ingen klient-boks.
  "/scan",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function VaultGate() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { status } = useVault();

  useEffect(() => {
    if (isPublic(pathname)) return;
    if (status === "signed-out") router.replace(`/welcome`);
    else if (status === "locked") router.replace("/gendan?locked=1");
  }, [pathname, router, status]);

  return null;
}
