"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { WebShell } from "@/components/web/WebShell";
import { getDesktopSnapshot, subscribeDesktop } from "@/lib/desktop-query";

// Appen fylder altid hele browserens viewport (bruger 2026-09-29). Bred
// skærm får desktop-skallen, bygget på admin-skallen; mindre skærme får appen
// som den er (grænsen står i src/lib/desktop-query.ts).
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);

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
    // Alle sider på desktop vises i skallen (sidebjælke, topmenu, brødkrummer),
    // også login og betingelser — aldrig alene (bruger 2026-10-02).
    return <WebShell>{children}</WebShell>;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-contain bg-hf-cream">
      {children}
    </div>
  );
}
