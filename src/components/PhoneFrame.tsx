"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isPublicPath } from "@/components/AuthGate";
import { WebShell } from "@/components/web/WebShell";

// Ingen telefonramme (bruger 2026-09-29): appen fylder altid hele
// browserens viewport. Bred skærm får desktop-skallen (bygget på admin-
// skallen), mindre skærme får appen som den er.
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );

  // The admin surface (docs/ADMIN.md) is a separate, desktop-and-mobile
  // responsive interface, and /hello-doc/[token] is opened by an external
  // doctor/dietitian from an email link — both render full-viewport.
  const isFullViewport = pathname.startsWith("/admin") || pathname.startsWith("/hello-doc");
  if (isFullViewport) return <>{children}</>;

  if (isDesktop) {
    if (!isPublicPath(pathname)) return <WebShell>{children}</WebShell>;
    // Log ind, opret og øvrige offentlige sider: centreret kolonne uden ramme.
    return (
      <div className="flex h-dvh justify-center bg-page-bg">
        <div
          className="phone-frame-content flex h-full w-full max-w-lg flex-col overflow-hidden overscroll-contain bg-hf-cream"
          style={{ transform: "translateZ(0)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame-content flex h-dvh flex-col overflow-hidden overscroll-contain bg-hf-cream">
      {children}
    </div>
  );
}
