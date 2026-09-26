import { adapterBySlug, redirectUri as integrationRedirectUri } from "@/lib/integrations/registry";

// Oversigt over alle API-nøgler og tjenester, appen bruger (admin →
// API-nøgler, docs/DECISIONS.md 2026-09-25 "API-nøgler i admin"). Kun felter
// med `editable` kan rettes fra admin; resten (database, sessionsnøgler,
// adresser) læses ved opstart og kan kun ændres i .env.production.

export type KeyKind = "id" | "secret" | "text";

export type KeyField = {
  key: string;
  label: string;
  kind: KeyKind;
  optional?: boolean;
  editable?: boolean;
  multiline?: boolean;
  hint?: string;
};

export type KeyGroupId = "login" | "integrations" | "ai" | "payment" | "mail" | "push" | "system";

export type KeyService = {
  id: string;
  name: string;
  group: KeyGroupId;
  purpose: string;
  fields: KeyField[];
  setupUrl?: string;
  // Redirect-URI'er, der skal være registreret hos udbyderen.
  redirectUris?: () => string[];
  testable: boolean;
  note?: string;
};

export const KEY_GROUPS: { id: KeyGroupId; title: string }[] = [
  { id: "login", title: "Log ind" },
  { id: "integrations", title: "Sundhedsintegrationer" },
  { id: "ai", title: "AI og fødevaredata" },
  { id: "payment", title: "Betaling" },
  { id: "mail", title: "E-mail" },
  { id: "push", title: "Push-notifikationer" },
  { id: "system", title: "System (kun .env.production)" },
];

function appBase() {
  return (process.env.APP_BASE_URL || "https://hellocal.packroff.dk").replace(/\/$/, "");
}

function loginRedirect(provider: string) {
  return () => [`${appBase()}/api/auth/oauth/${provider}/callback`];
}

function integrationRedirect(slug: string) {
  return () => {
    const adapter = adapterBySlug(slug);
    if (!adapter) return [];
    try {
      return [integrationRedirectUri(adapter)];
    } catch {
      return [`${appBase()}/api/integrations/${slug}/callback`];
    }
  };
}

function clientPair(prefix: string, idLabel = "Client ID", secretLabel = "Client secret"): KeyField[] {
  return [
    { key: `${prefix}_CLIENT_ID`, label: idLabel, kind: "id" },
    { key: `${prefix}_CLIENT_SECRET`, label: secretLabel, kind: "secret" },
  ];
}

export const KEY_SERVICES: KeyService[] = [
  {
    id: "google-login",
    name: "Google-login",
    group: "login",
    purpose: "“Log ind med Google” på login- og opret-siden.",
    fields: clientPair("GOOGLE"),
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    redirectUris: loginRedirect("google"),
    testable: true,
  },
  {
    id: "facebook",
    name: "Facebook-login",
    group: "login",
    purpose: "“Log ind med Facebook”.",
    fields: [
      { key: "FACEBOOK_APP_ID", label: "App ID", kind: "id" },
      { key: "FACEBOOK_APP_SECRET", label: "App secret", kind: "secret" },
    ],
    setupUrl: "https://developers.facebook.com/apps",
    redirectUris: loginRedirect("facebook"),
    testable: true,
    note: "Appen skal stå som “Live” i Meta for Developers, ellers kan kun du selv logge ind.",
  },
  {
    id: "apple",
    name: "Apple-login",
    group: "login",
    purpose: "“Log ind med Apple” (kræver betalt Apple Developer-konto).",
    fields: [
      { key: "APPLE_CLIENT_ID", label: "Services ID", kind: "id" },
      { key: "APPLE_TEAM_ID", label: "Team ID", kind: "id" },
      { key: "APPLE_KEY_ID", label: "Key ID", kind: "id" },
      {
        key: "APPLE_PRIVATE_KEY",
        label: "Privat nøgle (.p8)",
        kind: "secret",
        multiline: true,
        hint: "Indsæt hele indholdet af .p8-filen inkl. BEGIN/END-linjerne.",
      },
    ],
    setupUrl: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
    redirectUris: loginRedirect("apple"),
    testable: true,
  },
  {
    id: "withings",
    name: "Withings",
    group: "integrations",
    purpose: "Vægt og fedtprocent fra Withings-vægte.",
    fields: [
      ...clientPair("WITHINGS"),
      {
        key: "WITHINGS_REDIRECT_URI",
        label: "Redirect-URI (valgfri)",
        kind: "text",
        optional: true,
        hint: "Kun hvis Withings-appen er registreret med en anden adresse end standarden nedenfor.",
      },
    ],
    setupUrl: "https://developer.withings.com/dashboard",
    redirectUris: integrationRedirect("withings"),
    testable: true,
  },
  {
    id: "google-health",
    name: "Google Health",
    group: "integrations",
    purpose: "Aktivitet, skridt og vægt fra Google Health (afløser Fitbit Web API).",
    fields: [
      ...clientPair("GOOGLE_HEALTH"),
      {
        key: "GOOGLE_HEALTH_REDIRECT_URI",
        label: "Redirect-URI (valgfri)",
        kind: "text",
        optional: true,
        hint: "Kun hvis Google-klienten er registreret med en anden adresse end standarden nedenfor.",
      },
    ],
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    redirectUris: integrationRedirect("google-health"),
    testable: true,
    note: "“Google Health API” skal være slået til i samme Google Cloud-projekt.",
  },
  {
    id: "strava",
    name: "Strava",
    group: "integrations",
    purpose: "Træningspas fra Strava.",
    fields: clientPair("STRAVA"),
    setupUrl: "https://www.strava.com/settings/api",
    redirectUris: integrationRedirect("strava"),
    testable: true,
    note: "Hos Strava angives kun domænet (hellocal.packroff.dk) som “Authorization Callback Domain”.",
  },
  {
    id: "polar",
    name: "Polar Flow",
    group: "integrations",
    purpose: "Træningspas fra Polar.",
    fields: clientPair("POLAR"),
    setupUrl: "https://admin.polaraccesslink.com",
    redirectUris: integrationRedirect("polar"),
    testable: true,
  },
  {
    id: "fitbit",
    name: "Fitbit",
    group: "integrations",
    purpose: "Aktivitet og vægt fra Fitbit (udfases af Google til fordel for Google Health).",
    fields: clientPair("FITBIT"),
    setupUrl: "https://dev.fitbit.com/apps/new",
    redirectUris: integrationRedirect("fitbit"),
    testable: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "ai",
    purpose: "Stemme-tolkning af måltider og billedgenkendelse ved oprettelse af produkter.",
    fields: [
      { key: "OPENAI_API_KEY", label: "API-nøgle", kind: "secret" },
      {
        key: "OPENAI_PRODUCT_VISION_MODEL",
        label: "Billedmodel (valgfri)",
        kind: "text",
        optional: true,
        hint: "Tom = standardmodellen i koden.",
      },
    ],
    setupUrl: "https://platform.openai.com/api-keys",
    testable: true,
  },
  {
    id: "passio",
    name: "Passio Nutrition-AI",
    group: "ai",
    purpose: "Genkendelse af madvarer på tallerken-fotos i kameraet.",
    fields: [{ key: "PASSIO_API_KEY", label: "API-nøgle", kind: "secret" }],
    setupUrl: "https://accounts.passiolife.com",
    testable: true,
  },
  {
    id: "usda",
    name: "USDA FoodData Central",
    group: "ai",
    purpose: "Reserve-opslag af næringsindhold, når Open Food Facts ikke kender varen.",
    fields: [{ key: "USDA_FDC_API_KEY", label: "API-nøgle", kind: "secret" }],
    setupUrl: "https://fdc.nal.usda.gov/api-key-signup",
    testable: true,
  },
  {
    id: "google-places",
    name: "Google Places",
    group: "ai",
    purpose: "Butikker og steder. Bruges ikke af appen endnu — nøglen ligger klar.",
    fields: [{ key: "GOOGLE_PLACES_API_KEY", label: "API-nøgle", kind: "secret" }],
    setupUrl: "https://console.cloud.google.com/google/maps-apis/credentials",
    testable: true,
  },
  {
    id: "mobilepay",
    name: "MobilePay (Vipps MobilePay Recurring)",
    group: "payment",
    purpose: "Abonnementsbetaling med MobilePay: aftaler, månedlige træk og opsigelse.",
    fields: [
      { key: "MOBILEPAY_CLIENT_ID", label: "client_id", kind: "id" },
      { key: "MOBILEPAY_CLIENT_SECRET", label: "client_secret", kind: "secret" },
      { key: "MOBILEPAY_SUBSCRIPTION_KEY", label: "Ocp-Apim-Subscription-Key", kind: "secret" },
      { key: "MOBILEPAY_MERCHANT_SERIAL_NUMBER", label: "Merchant Serial Number (MSN)", kind: "id" },
      {
        key: "MOBILEPAY_ENV",
        label: "Miljø",
        kind: "text",
        optional: true,
        hint: "Skriv “test” for testmiljøet. Tomt = produktion.",
      },
    ],
    setupUrl: "https://portal.vippsmobilepay.com",
    testable: true,
    note: "Kræver at “Recurring API” er slået til på salgsstedet. Webhooken registreres automatisk af serveren.",
  },
  {
    id: "smtp",
    name: "Mailjet (SMTP)",
    group: "mail",
    purpose: "Mails om glemt adgangskode, login fra ny enhed og admin-advarsler.",
    fields: [
      { key: "SMTP_HOST", label: "Server", kind: "text" },
      { key: "SMTP_PORT", label: "Port", kind: "text" },
      { key: "SMTP_USER", label: "Brugernavn (API key)", kind: "id" },
      { key: "SMTP_PASS", label: "Adgangskode (secret key)", kind: "secret" },
      {
        key: "SMTP_FROM",
        label: "Afsender",
        kind: "text",
        hint: "Fx Hello Cal <no-reply@packroff.dk>. Domænet skal være verificeret i Mailjet.",
      },
    ],
    setupUrl: "https://app.mailjet.com/account/apikeys",
    testable: true,
  },
  {
    id: "push",
    name: "Web Push (VAPID)",
    group: "push",
    purpose: "Push-notifikationer på telefonen. Uden nøgler sendes ingen push-beskeder.",
    fields: [
      { key: "VAPID_PUBLIC_KEY", label: "Offentlig nøgle", kind: "id" },
      { key: "VAPID_PRIVATE_KEY", label: "Privat nøgle", kind: "secret" },
      {
        key: "VAPID_CONTACT_EMAIL",
        label: "Kontakt (valgfri)",
        kind: "text",
        optional: true,
        hint: "Fx mailto:peter@packroff.dk",
      },
    ],
    testable: true,
    note: "Nøgleparret laves med `npx web-push generate-vapid-keys`.",
  },
  {
    id: "system",
    name: "Server og sikkerhed",
    group: "system",
    purpose: "Læses kun ved opstart. Ændres i .env.production på Synology og kræver genstart.",
    fields: [
      { key: "DATABASE_URL", label: "Database", kind: "secret", editable: false },
      { key: "ADMIN_SESSION_SECRET", label: "Admin-sessionsnøgle", kind: "secret", editable: false },
      { key: "USER_SESSION_SECRET", label: "Bruger-sessionsnøgle", kind: "secret", editable: false },
      { key: "APP_BASE_URL", label: "Appens adresse", kind: "text", editable: false },
      {
        key: "INTEGRATIONS_REDIRECT_BASE_URL",
        label: "Adresse til integrationer",
        kind: "text",
        editable: false,
        optional: true,
      },
      { key: "ADMIN_BASE_URL", label: "Admin-adresse", kind: "text", editable: false, optional: true },
      {
        key: "ADMIN_NOTIFICATION_EMAIL",
        label: "Admin-mail til advarsler",
        kind: "text",
        editable: false,
        optional: true,
      },
    ],
    testable: false,
  },
];

export function isEditableKey(key: string) {
  return KEY_SERVICES.some((s) => s.fields.some((f) => f.key === key && f.editable !== false));
}

export function serviceById(id: string) {
  return KEY_SERVICES.find((s) => s.id === id) ?? null;
}
