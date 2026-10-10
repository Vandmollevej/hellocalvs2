import { adapterBySlug, redirectUri as integrationRedirectUri } from "@/lib/integrations/registry";

// Oversigt over alle API-nøgler og tjenester, appen bruger (admin →
// API-nøgler, docs/DECISIONS.md 2026-09-25 "API-nøgler i admin"). Kun felter
// med `editable` kan rettes fra admin; resten (database, sessionsnøgler,
// adresser) læses ved opstart og kan kun ændres i .env.production.

export type KeyKind = "id" | "secret" | "text";

// Den præcise side hos udbyderen, hvor værdien findes og styres (ikke
// forsiden). `where` er stien på siden, så man kan finde feltet, selv hvis
// udbyderen flytter rundt på menuen. `url` kan bygges ud fra en allerede sat
// værdi (fx Facebooks App ID), så linket går direkte til den rigtige app.
export type ManageLink = {
  url: string | (() => string);
  where: string;
};

export type KeyField = {
  key: string;
  label: string;
  kind: KeyKind;
  optional?: boolean;
  editable?: boolean;
  multiline?: boolean;
  hint?: string;
  // Påkrævet: alle eksterne værdier skal vise, præcis hvor de styres.
  manage: ManageLink;
};

export type KeyGroupId = "login" | "integrations" | "ai" | "payment" | "mail" | "sms" | "push" | "system";

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
  { id: "sms", title: "SMS" },
  { id: "push", title: "Push-notifikationer" },
  { id: "system", title: "System (kun .env.production)" },
];

function appBase() {
  return (process.env.APP_BASE_URL || "https://hellocal.io").replace(/\/$/, "");
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

function clientPair(
  prefix: string,
  manage: ManageLink,
  idLabel = "Client ID",
  secretLabel = "Client secret",
): KeyField[] {
  return [
    { key: `${prefix}_CLIENT_ID`, label: idLabel, kind: "id", manage },
    { key: `${prefix}_CLIENT_SECRET`, label: secretLabel, kind: "secret", manage },
  ];
}

function currentValue(key: string) {
  return process.env[key]?.trim() || "";
}

const GOOGLE_OAUTH_CLIENTS: ManageLink = {
  url: "https://console.cloud.google.com/auth/clients",
  where: "Google Cloud → Google Auth Platform → Clients → vælg klienten",
};

function facebookApp(path: string) {
  return () => {
    const appId = currentValue("FACEBOOK_APP_ID");
    return appId
      ? `https://developers.facebook.com/apps/${encodeURIComponent(appId)}/${path}`
      : "https://developers.facebook.com/apps";
  };
}

const APPLE_KEYS: ManageLink = {
  url: "https://developer.apple.com/account/resources/authkeys/list",
  where: "Apple Developer → Certificates, Identifiers & Profiles → Keys",
};

const MAILJET_SMTP: ManageLink = {
  url: "https://app.mailjet.com/account/relay",
  where: "Mailjet → Account settings → SMTP and SEND API settings",
};

const MAILJET_API_KEYS: ManageLink = {
  url: "https://app.mailjet.com/account/apikeys",
  where: "Mailjet → Account settings → API Key Management",
};

const TEAMMESSAGE_ACCOUNT: ManageLink = {
  url: "https://www.teammessage.de",
  where: "TeamMessage → log ind → Einstellungen (kontoindstillinger) → API",
};

const WITHINGS_APP: ManageLink = {
  url: "https://developer.withings.com/dashboard/",
  where: "Withings Developer Dashboard → din app → Client ID / Secret / Callback URL",
};

const HUAWEI_PROJECT: ManageLink = {
  url: "https://developer.huawei.com/consumer/en/service/josp/agc/index.html#/myProject",
  where: "AppGallery Connect → My projects → projektet → Project settings → General information → App information",
};

const VAPID_KEYS: ManageLink = {
  url: "https://github.com/web-push-libs/web-push#command-line",
  where: "Laves lokalt med `npx web-push generate-vapid-keys` (ingen udbyder-konto)",
};

// Systemværdier ligger kun i .env.production på Synology; skabelonen med
// alle navne ligger i repoet.
const ENV_PRODUCTION: ManageLink = {
  url: "https://github.com/Vandmollevej/hellocalvs2/blob/master/.env.production.example",
  where: "Synology → hellocal-mappen → .env.production (skabelon: .env.production.example), kræver genstart",
};

const VIPPS_DEVELOPER_KEYS: ManageLink = {
  url: "https://portal.vippsmobilepay.com",
  where: "Vipps MobilePay-portalen → For developers → Production → salgsstedet → Show keys",
};

export const KEY_SERVICES: KeyService[] = [
  {
    id: "google-login",
    name: "Google-login",
    group: "login",
    purpose: "“Log ind med Google” på login- og opret-siden.",
    fields: clientPair("GOOGLE", GOOGLE_OAUTH_CLIENTS),
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
      {
        key: "FACEBOOK_APP_ID",
        label: "App ID",
        kind: "id",
        manage: { url: "https://developers.facebook.com/apps", where: "Meta for Developers → My Apps (App ID står på app-kortet)" },
      },
      {
        key: "FACEBOOK_APP_SECRET",
        label: "App secret",
        kind: "secret",
        manage: { url: facebookApp("settings/basic/"), where: "Meta for Developers → appen → App settings → Basic → App secret" },
      },
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
      {
        key: "APPLE_CLIENT_ID",
        label: "Services ID",
        kind: "id",
        manage: {
          url: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
          where: "Apple Developer → Certificates, Identifiers & Profiles → Identifiers → Services IDs",
        },
      },
      {
        key: "APPLE_TEAM_ID",
        label: "Team ID",
        kind: "id",
        manage: {
          url: "https://developer.apple.com/account#MembershipDetailsCard",
          where: "Apple Developer → Account → Membership details → Team ID",
        },
      },
      { key: "APPLE_KEY_ID", label: "Key ID", kind: "id", manage: APPLE_KEYS },
      {
        key: "APPLE_PRIVATE_KEY",
        label: "Privat nøgle (.p8)",
        kind: "secret",
        multiline: true,
        hint: "Indsæt hele indholdet af .p8-filen inkl. BEGIN/END-linjerne.",
        manage: APPLE_KEYS,
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
      ...clientPair("WITHINGS", WITHINGS_APP),
      {
        key: "WITHINGS_REDIRECT_URI",
        label: "Redirect-URI (valgfri)",
        kind: "text",
        optional: true,
        hint: "Kun hvis Withings-appen er registreret med en anden adresse end standarden nedenfor.",
        manage: WITHINGS_APP,
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
      ...clientPair("GOOGLE_HEALTH", GOOGLE_OAUTH_CLIENTS),
      {
        key: "GOOGLE_HEALTH_REDIRECT_URI",
        label: "Redirect-URI (valgfri)",
        kind: "text",
        optional: true,
        hint: "Kun hvis Google-klienten er registreret med en anden adresse end standarden nedenfor.",
        manage: GOOGLE_OAUTH_CLIENTS,
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
    fields: clientPair("STRAVA", {
      url: "https://www.strava.com/settings/api",
      where: "Strava → Settings → My API Application",
    }),
    setupUrl: "https://www.strava.com/settings/api",
    redirectUris: integrationRedirect("strava"),
    testable: true,
    note: "Hos Strava angives kun domænet (hellocal.io) som “Authorization Callback Domain”.",
  },
  {
    id: "polar",
    name: "Polar Flow",
    group: "integrations",
    purpose: "Træningspas fra Polar.",
    fields: clientPair("POLAR", {
      url: "https://admin.polaraccesslink.com",
      where: "Polar AccessLink admin → Clients → din klient (siden åbner på klientlisten)",
    }),
    setupUrl: "https://admin.polaraccesslink.com",
    redirectUris: integrationRedirect("polar"),
    testable: true,
  },
  {
    id: "garmin",
    name: "Garmin",
    group: "integrations",
    purpose: "Træning, skridt, søvn, puls og vægt fra Garmin Connect (Health API + Activity API).",
    fields: [
      ...clientPair(
        "GARMIN",
        {
          url: "https://developerportal.garmin.com/user/me/apps",
          where: "Garmin Developer Portal → My Apps → din app → Consumer Key / Consumer Secret",
        },
        "Consumer key",
        "Consumer secret",
      ),
      {
        key: "GARMIN_WEBHOOK_KEY",
        label: "Webhook-nøgle (valgfri)",
        kind: "secret",
        optional: true,
        hint: "Tilfældig tekst. Sæt ping-adressen hos Garmin til <base>/api/integrations/garmin/webhook?key=<nøglen>.",
        manage: {
          url: "https://apis.garmin.com/tools/endpoints",
          where: "Garmin Endpoint Configuration (log ind med consumer key + secret) → ping-adresserne",
        },
      },
    ],
    setupUrl: "https://developerportal.garmin.com",
    redirectUris: integrationRedirect("garmin"),
    testable: true,
    note: "Kræver godkendelse i Garmin Connect Developer Program. Slå Ping-tilstand til for Dailies, Activities, Sleeps, Body Compositions og Deregistrations med adressen <base>/api/integrations/garmin/webhook.",
  },
  {
    id: "whoop",
    name: "WHOOP",
    group: "integrations",
    purpose: "Træning, søvn, hvilepuls og HRV fra WHOOP.",
    fields: clientPair("WHOOP", {
      url: "https://developer-dashboard.whoop.com/apps",
      where: "WHOOP Developer Dashboard → Apps → din app → Client ID / Client Secret",
    }),
    setupUrl: "https://developer-dashboard.whoop.com",
    redirectUris: integrationRedirect("whoop"),
    testable: true,
    note: "Vælg kun scopes read:workout, read:sleep, read:recovery og offline (ikke profil).",
  },
  {
    id: "huawei-health",
    name: "Huawei Health",
    group: "integrations",
    purpose: "Skridt, træning, søvn og vægt fra Huawei Health Kit.",
    fields: [
      ...clientPair("HUAWEI_HEALTH", HUAWEI_PROJECT),
      {
        key: "HUAWEI_HEALTH_API_BASE",
        label: "API-adresse (valgfri)",
        kind: "text",
        optional: true,
        hint: "Tom = https://health-api.cloud.huawei.com/healthkit/v2. Huawei kræver brugerens region.",
        manage: HUAWEI_PROJECT,
      },
    ],
    setupUrl: "https://developer.huawei.com/consumer/en/console#/serviceCards/",
    redirectUris: integrationRedirect("huawei-health"),
    testable: true,
    note: "Health Kit skal være godkendt til læse-scopes for skridt, distance, kalorier, puls, vægt, søvn og træning.",
  },
  {
    id: "fitbit",
    name: "Fitbit",
    group: "integrations",
    purpose: "Aktivitet og vægt fra Fitbit (udfases af Google til fordel for Google Health).",
    fields: clientPair("FITBIT", {
      url: "https://dev.fitbit.com/apps",
      where: "Fitbit → Manage My Apps → din app → OAuth 2.0 Client ID / Client Secret",
    }),
    setupUrl: "https://dev.fitbit.com/apps/new",
    redirectUris: integrationRedirect("fitbit"),
    testable: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "ai",
    purpose: "Stemme-tolkning af måltider og billedgenkendelse ved oprettelse af varer.",
    fields: [
      {
        key: "OPENAI_API_KEY",
        label: "API-nøgle",
        kind: "secret",
        manage: { url: "https://platform.openai.com/api-keys", where: "OpenAI Platform → API keys" },
      },
      {
        key: "OPENAI_PRODUCT_VISION_MODEL",
        label: "Billedmodel (valgfri)",
        kind: "text",
        optional: true,
        hint: "Tom = standardmodellen i koden.",
        manage: { url: "https://platform.openai.com/docs/models", where: "OpenAI Platform → Docs → Models (gyldige modelnavne)" },
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
    fields: [
      {
        key: "PASSIO_API_KEY",
        label: "API-nøgle",
        kind: "secret",
        manage: {
          url: "https://accounts.passiolife.com",
          where: "Passio-kontoportalen → log ind → din nøgle står på kontosiden (Key)",
        },
      },
    ],
    setupUrl: "https://accounts.passiolife.com",
    testable: true,
  },
  {
    id: "usda",
    name: "USDA FoodData Central",
    group: "ai",
    purpose: "Reserve-opslag af næringsindhold, når Open Food Facts ikke kender varen.",
    fields: [
      {
        key: "USDA_FDC_API_KEY",
        label: "API-nøgle",
        kind: "secret",
        manage: {
          url: "https://fdc.nal.usda.gov/api-key-signup",
          where: "USDA FoodData Central → API Key Signup (nøglen sendes på mail; ny nøgle = tilmeld igen)",
        },
      },
    ],
    setupUrl: "https://fdc.nal.usda.gov/api-key-signup",
    testable: true,
  },
  {
    id: "google-places",
    name: "Google Places",
    group: "ai",
    purpose: "Butiksnavn ud fra lokationen på Oprettelses-appens hyldebilleder.",
    fields: [
      {
        key: "GOOGLE_PLACES_API_KEY",
        label: "API-nøgle",
        kind: "secret",
        manage: {
          url: "https://console.cloud.google.com/google/maps-apis/credentials",
          where: "Google Cloud → Google Maps Platform → Keys & Credentials",
        },
      },
    ],
    setupUrl: "https://console.cloud.google.com/google/maps-apis/credentials",
    testable: true,
  },
  {
    id: "stripe",
    name: "Stripe (MobilePay i Danmark, kort/EC i Tyskland)",
    group: "payment",
    purpose: "Abonnementsbetaling: MobilePay for danske og kort inkl. EC-kort (girocard) for tyske brugere.",
    fields: [
      {
        key: "STRIPE_SECRET_KEY",
        label: "Secret key (sk_live_… / sk_test_…)",
        kind: "secret",
        manage: { url: "https://dashboard.stripe.com/apikeys", where: "Stripe → Developers → API keys → Secret key" },
      },
      {
        key: "STRIPE_WEBHOOK_SECRET",
        label: "Webhook-hemmelighed (whsec_…)",
        kind: "secret",
        optional: true,
        hint: "Kun hvis webhooken er lavet i Stripe-dashboardet. Tomt = serveren registrerer webhooken selv.",
        manage: {
          url: "https://dashboard.stripe.com/webhooks",
          where: "Stripe → Developers → Webhooks → endpointet → Signing secret",
        },
      },
    ],
    setupUrl: "https://dashboard.stripe.com/apikeys",
    testable: true,
    note: "Slå MobilePay og kort til under Indstillinger → Betalingsmetoder i Stripe (dashboard.stripe.com/settings/payment_methods). Webhooken (/api/payments/stripe/webhook) registreres automatisk af serveren.",
  },
  {
    id: "mobilepay",
    name: "MobilePay (Vipps MobilePay Recurring)",
    group: "payment",
    purpose: "Abonnementsbetaling med MobilePay: aftaler, månedlige træk og opsigelse.",
    fields: [
      { key: "MOBILEPAY_CLIENT_ID", label: "client_id", kind: "id", manage: VIPPS_DEVELOPER_KEYS },
      { key: "MOBILEPAY_CLIENT_SECRET", label: "client_secret", kind: "secret", manage: VIPPS_DEVELOPER_KEYS },
      {
        key: "MOBILEPAY_SUBSCRIPTION_KEY",
        label: "Ocp-Apim-Subscription-Key",
        kind: "secret",
        manage: VIPPS_DEVELOPER_KEYS,
      },
      {
        key: "MOBILEPAY_MERCHANT_SERIAL_NUMBER",
        label: "Merchant Serial Number (MSN)",
        kind: "id",
        manage: VIPPS_DEVELOPER_KEYS,
      },
      {
        key: "MOBILEPAY_ENV",
        label: "Miljø",
        kind: "text",
        optional: true,
        hint: "Skriv “test” for testmiljøet. Tomt = produktion.",
        manage: {
          url: "https://portal.vippsmobilepay.com",
          where: "Vipps MobilePay-portalen → For developers → fanen Test eller Production",
        },
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
      { key: "SMTP_HOST", label: "Server", kind: "text", manage: MAILJET_SMTP },
      { key: "SMTP_PORT", label: "Port", kind: "text", manage: MAILJET_SMTP },
      { key: "SMTP_USER", label: "Brugernavn (API key)", kind: "id", manage: MAILJET_API_KEYS },
      { key: "SMTP_PASS", label: "Adgangskode (secret key)", kind: "secret", manage: MAILJET_API_KEYS },
      {
        key: "SMTP_FROM",
        label: "Afsender",
        kind: "text",
        hint: "Fx Hello Cal <no-reply@hellocal.io>. Domænet skal være verificeret i Mailjet.",
        manage: {
          url: "https://app.mailjet.com/account/sender",
          where: "Mailjet → Account settings → Sender addresses & domains",
        },
      },
    ],
    setupUrl: "https://app.mailjet.com/account/apikeys",
    testable: true,
  },
  {
    id: "teammessage",
    name: "TeamMessage (SMS)",
    group: "sms",
    purpose: "SMS-koder ved tilmelding og glemt adgangskode.",
    fields: [
      { key: "TEAMMESSAGE_API_TOKEN", label: "API-token (Bearer)", kind: "secret", manage: TEAMMESSAGE_ACCOUNT },
      {
        key: "TEAMMESSAGE_TEAM_ID",
        label: "Team ID",
        kind: "id",
        manage: { url: "https://www.teammessage.de", where: "TeamMessage → log ind → Teams → teamet (ID’et står i adresselinjen)" },
      },
      {
        key: "TEAMMESSAGE_TEAMLIST_EMAIL",
        label: "Teamliste-mail",
        kind: "text",
        manage: { url: "https://www.teammessage.de", where: "TeamMessage → log ind → Teams → teamet → Teamliste" },
      },
      {
        key: "TEAMMESSAGE_SENDER_EMAIL",
        label: "Afsender-mail (valgfri)",
        kind: "text",
        optional: true,
        manage: TEAMMESSAGE_ACCOUNT,
      },
      {
        key: "TEAMMESSAGE_FROM",
        label: "Afsendernavn (valgfri)",
        kind: "text",
        optional: true,
        hint: "Fx HelloCal. Højst 11 tegn uden mellemrum.",
        manage: TEAMMESSAGE_ACCOUNT,
      },
      {
        key: "TEAMMESSAGE_API_BASE_URL",
        label: "API-adresse (valgfri)",
        kind: "text",
        optional: true,
        hint: "Tom = https://www.teammessage.de",
        manage: {
          url: "https://www.teammessage.eu/en/dokumentation/api/",
          where: "TeamMessage → API-dokumentation (basisadressen)",
        },
      },
    ],
    setupUrl: "https://www.teammessage.eu/en/dokumentation/api/",
    testable: true,
    note: "API-tokenet laves under kontoindstillinger hos TeamMessage. Testen sender ingen SMS.",
  },
  {
    id: "push",
    name: "Web Push (VAPID)",
    group: "push",
    purpose: "Push-notifikationer på telefonen. Uden nøgler sendes ingen push-beskeder.",
    fields: [
      { key: "VAPID_PUBLIC_KEY", label: "Offentlig nøgle", kind: "id", manage: VAPID_KEYS },
      { key: "VAPID_PRIVATE_KEY", label: "Privat nøgle", kind: "secret", manage: VAPID_KEYS },
      {
        key: "VAPID_CONTACT_EMAIL",
        label: "Kontakt (valgfri)",
        kind: "text",
        optional: true,
        hint: "Fx mailto:support@hellocal.io",
        manage: VAPID_KEYS,
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
      { key: "DATABASE_URL", label: "Database", kind: "secret", editable: false, manage: ENV_PRODUCTION },
      { key: "ADMIN_SESSION_SECRET", label: "Admin-sessionsnøgle", kind: "secret", editable: false, manage: ENV_PRODUCTION },
      { key: "USER_SESSION_SECRET", label: "Bruger-sessionsnøgle", kind: "secret", editable: false, manage: ENV_PRODUCTION },
      { key: "APP_BASE_URL", label: "Appens adresse", kind: "text", editable: false, manage: ENV_PRODUCTION },
      {
        key: "INTEGRATIONS_REDIRECT_BASE_URL",
        label: "Adresse til integrationer",
        kind: "text",
        editable: false,
        optional: true,
        manage: ENV_PRODUCTION,
      },
      {
        key: "ADMIN_BASE_URL",
        label: "Admin-adresse",
        kind: "text",
        editable: false,
        optional: true,
        manage: ENV_PRODUCTION,
      },
      {
        key: "ADMIN_NOTIFICATION_EMAIL",
        label: "Admin-mail til advarsler",
        kind: "text",
        editable: false,
        optional: true,
        manage: ENV_PRODUCTION,
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
