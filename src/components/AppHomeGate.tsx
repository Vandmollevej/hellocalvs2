"use client";

import { useSyncExternalStore } from "react";
import { getDesktopSnapshot, subscribeDesktop } from "@/lib/desktop-query";

type HomeView = "app" | "web" | "pending";

// Forsiden med drejehjul, tilføj-cirkel og dagens liste hører kun til appen.
// I webversionen (desktop-skallen i AppFrame) findes den slet ikke (bruger
// 2026-10-11): ingen af forsidens komponenter monteres, og der hentes ingen
// data, så siden aldrig starter med at loade hjul og spinnere. Skallen sender
// selv roden videre til kalenderens dagsvisning (WebShell).
//
// `serverView` er kun et hint til første rendering: telefoner/tablets får
// forsiden i server-HTML'en som hidtil ("app"), alle andre en tom flade
// ("pending"), indtil klienten kender skærmbredden. Afgørelsen tages altid på
// skærmbredden, aldrig på hintet.
export function AppHomeGate({
  serverView,
  children,
}: {
  serverView: "app" | "pending";
  children: React.ReactNode;
}) {
  const view = useSyncExternalStore<HomeView>(
    subscribeDesktop,
    () => (getDesktopSnapshot() ? "web" : "app"),
    () => serverView,
  );

  if (view !== "app") return <div aria-hidden className="min-h-full flex-1 bg-hf-cream" />;
  return <>{children}</>;
}
