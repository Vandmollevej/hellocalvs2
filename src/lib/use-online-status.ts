"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";

// Fælles offline-registrering (docs/OFFLINE-AUDIT.md). Alle skærme bruger
// denne hook i stedet for at gætte på `navigator.onLine` hver for sig.

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

// fetch() afvises med en TypeError, når der slet ingen forbindelse er.
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
}

// Giver en fejltekst, der siger "ingen forbindelse", når enheden er offline,
// og ellers den almindelige fejltekst for skærmen.
export function useConnectionMessage(): (fallback: string) => string {
  const online = useOnlineStatus();
  const { t } = useTranslation();
  return useCallback((fallback: string) => (online ? fallback : t("offline.message")), [online, t]);
}
