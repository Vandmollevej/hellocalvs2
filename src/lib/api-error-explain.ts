// Admin → API-forbrug: udbydernes fejlbeskeder oversat til hvad der er galt og
// hvor det rettes (brugerens ønske 2026-10-17, efter at Google-nøglen til
// billedrobotten blev afvist med API_KEY_SERVICE_BLOCKED). Ren logik uden
// database, så den kan testes og bruges i klienten.

export type ApiProblem = {
  /** Kort overskrift, fx "Nøglen må ikke bruge Custom Search API". */
  title: string;
  /** Hvad admin skal gøre. */
  action: string;
  /** Hvor det rettes hos udbyderen. */
  fixUrl: string | null;
};

const GOOGLE_CREDENTIALS = "https://console.cloud.google.com/apis/credentials";
const GOOGLE_LIBRARY = "https://console.cloud.google.com/apis/library";
const GOOGLE_BILLING = "https://console.cloud.google.com/billing";

const GOOGLE_API_NAME: Record<string, string> = {
  "google-search": "Custom Search API",
  "google-vision": "Cloud Vision API",
  "google-places": "Places API",
};

// Nøgler må aldrig vises: ældre fejl kunne indeholde adressen med ?key=...
export function redactSecrets(text: string): string {
  return text
    .replace(/(key=)[^&\s'"]+/gi, "$1***")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, "***")
    .replace(/\bsk-[0-9A-Za-z_-]{16,}/g, "***");
}

export function explainApiError(serviceId: string, raw: string | null | undefined): ApiProblem | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const api = GOOGLE_API_NAME[serviceId];
  if (api) {
    if (text.includes("api_key_service_blocked") || /requests to this api .* are blocked/.test(text)) {
      return {
        title: `Nøglen må ikke bruge ${api}`,
        action: `Åbn nøglen i Google Cloud → API-nøgler og tilføj “${api}” under API-begrænsninger.`,
        fixUrl: GOOGLE_CREDENTIALS,
      };
    }
    if (text.includes("service_disabled") || text.includes("has not been used in project") || text.includes("is disabled")) {
      return {
        title: `${api} er ikke slået til`,
        action: `Slå “${api}” til i Google Cloud-projektet (API-biblioteket).`,
        fixUrl: GOOGLE_LIBRARY,
      };
    }
    if (text.includes("api_key_invalid") || text.includes("api key not valid") || text.includes("api key expired")) {
      return {
        title: "Nøglen er ugyldig eller slettet",
        action: "Lav en ny nøgle i Google Cloud → API-nøgler og sæt den på serveren.",
        fixUrl: GOOGLE_CREDENTIALS,
      };
    }
    if (text.includes("billing_disabled") || text.includes("billing to be enabled") || text.includes("billing account")) {
      return {
        title: "Fakturering er slået fra",
        action: "Tilknyt en betalingskonto til Google Cloud-projektet.",
        fixUrl: GOOGLE_BILLING,
      };
    }
    if (text.includes("resource_exhausted") || text.includes("quota") || /\b429\b/.test(text)) {
      return {
        title: "Kvoten er brugt op",
        action: "Vent til kvoten nulstilles, eller hæv grænsen i Google Cloud.",
        fixUrl: GOOGLE_LIBRARY,
      };
    }
  }
  if (/\b401\b|unauthori[sz]ed|invalid[_ ]api[_ ]key|incorrect api key/.test(text)) {
    return { title: "Nøglen afvises", action: "Tjek nøglen hos udbyderen og sæt den igen.", fixUrl: null };
  }
  return null;
}
