"use client";

import { useEffect } from "react";

// Userback feedback-widget. Adgangstokenet er et offentligt widget-token (det
// ligger i sidens kode hos alle Userback-kunder). Vi sender bevidst ingen
// `Userback.user_data`: appen holder identitet adskilt fra brugerens data
// (docs/DECISIONS.md "anonym statistik"), så feedback er anonym.
const USERBACK_ACCESS_TOKEN = "A-rf4vW8rEw0qzlx6PXXUG3wyo8";
const USERBACK_SCRIPT_URL = "https://static.userback.io/widget/v1.js";

declare global {
  interface Window {
    Userback?: { access_token?: string };
  }
}

export function UserbackWidget() {
  useEffect(() => {
    if (document.querySelector("script[data-hc-userback]")) return;
    window.Userback = window.Userback || {};
    window.Userback.access_token = USERBACK_ACCESS_TOKEN;
    const script = document.createElement("script");
    script.async = true;
    script.src = USERBACK_SCRIPT_URL;
    script.dataset.hcUserback = "";
    document.head.appendChild(script);
  }, []);
  return null;
}
