"use client";

import { useEffect } from "react";
import { UMAMI_PROXY_PATH, UMAMI_TRACKED_HOSTS, UMAMI_WEBSITE_ID } from "@/lib/umami-config";

// Cookiefri besøgsstatistik via den selv-hostede Umami (docs/DECISIONS.md
// 2026-09-27 "Umami-analyse"). Scriptet indlæses kun på den brugerrettede
// app's domæner — aldrig på admin, Oprettelses-appen eller localhost.
// Forespørgselsstrenge og #-dele sendes ikke med, så fx links til
// nulstilling af adgangskode aldrig havner i statistikken.
export function UmamiTracker() {
  useEffect(() => {
    if (!UMAMI_TRACKED_HOSTS.includes(window.location.hostname)) return;
    if (document.querySelector("script[data-hc-umami]")) return;
    const script = document.createElement("script");
    script.src = `${UMAMI_PROXY_PATH}/script.js`;
    script.defer = true;
    script.dataset.hcUmami = "";
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    script.dataset.hostUrl = UMAMI_PROXY_PATH;
    script.dataset.domains = UMAMI_TRACKED_HOSTS.join(",");
    script.dataset.excludeSearch = "true";
    script.dataset.excludeHash = "true";
    document.head.appendChild(script);
  }, []);
  return null;
}
