"use client";

import { useSyncExternalStore } from "react";
import { getDesktopSnapshot, subscribeDesktop } from "@/lib/desktop-query";

// Webgrænsen som hook: fra 1024 px (`DESKTOP_QUERY` i desktop-query.ts, samme
// grænse som desktop-skallen) er en popup en lightbox i stedet for et bundark
// (KRAV.md "Popups på web"). Server-snapshot er false (mobil).
export function useDesktopViewport() {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
}