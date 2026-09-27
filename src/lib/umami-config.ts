// Umami-analyse (docs/DECISIONS.md 2026-09-27 "Umami-analyse"). Rene
// konstanter uden server-imports, så sporingskomponenten kan bruge dem.

// Fast website-id: appen opretter selv websitet i Umami med præcis dette id
// (src/lib/umami.ts), så sporingsscriptet kan kende det ved build-tid.
export const UMAMI_WEBSITE_ID = "1cc237b0-e1e7-4b55-a4ba-bc1fec7d397f";
export const UMAMI_WEBSITE_NAME = "Hello Cal";
export const UMAMI_WEBSITE_DOMAIN = "hellocal.io";

// Kun den brugerrettede app spores — ikke admin, Oprettelses-appen eller
// localhost. Den gamle packroff-adresse er med under domæneflytningen.
export const UMAMI_TRACKED_HOSTS = ["hellocal.io", "www.hellocal.io", "hellocal.packroff.dk"];

// Umami-containeren er ikke udstillet; appen sender scriptet og
// hændelserne videre fra disse stier (src/app/umami/**).
export const UMAMI_PROXY_PATH = "/umami";
