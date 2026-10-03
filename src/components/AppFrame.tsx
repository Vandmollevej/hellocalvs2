"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { isPublicPath } from "@/components/AuthGate";
import { WebShell } from "@/components/web/WebShell";

// Appen fylder altid hele browserens viewport (bruger 2026-09-29). Bred
// skærm får desktop-skallen, bygget på admin-skallen; mindre skærme får appen
// som den er.
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );

  // The admin surface (docs/ADMIN.md) is a separate, desktop-and-mobile
  // responsive interface, and /hello-doc/[token] is opened by an external
  // doctor/dietitian from an email link — both render full-viewport. So do the
  // public marketing pages linked from the landing page's footer.
  const isFullViewport =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/hello-doc") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/presse") ||
    // Partnerportalen for B2B-brugere har eget login (docs/DECISIONS.md 2026-10-02).
    pathname.startsWith("/partner");
  if (isFullViewport) return <>{children}</>;

  if (isDesktop) {
    if (!isPublicPath(pathname)) return <WebShell>{children}</WebShell>;
    // Log ind, opret og øvrige offentlige sider: som admin-loginsiden.
    return (
      <div className="flex h-dvh justify-center bg-page-bg">
        <div
          className="flex h-full w-full max-w-4xl flex-col overflow-hidden overscroll-contain bg-hf-cream"
          style={{ transform: "translateZ(0)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-contain bg-hf-cream">
      {children}
    </div>
  );
}
