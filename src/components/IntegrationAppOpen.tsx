"use client";

import { useEffect } from "react";

// Melder til serveren, at appen er fremme (ny side/genindlæsning, eller fanen
// bliver synlig igen), så udskudte integrationsdata hentes
// (api/integrations/app-open). Native gør det samme ved forgrund (HelloCalApp.kt).
export function IntegrationAppOpen() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void fetch("/api/integrations/app-open", { method: "POST" }).catch(() => {});
    };
    ping();
    document.addEventListener("visibilitychange", ping);
    return () => document.removeEventListener("visibilitychange", ping);
  }, []);
  return null;
}
