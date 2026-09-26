import nodemailer from "nodemailer";
import webpush from "web-push";
import { importPKCS8 } from "jose";

// Live-test af API-nøgler (admin → API-nøgler → "Test"). Hver test kalder
// udbyderen med de nøgler, serveren bruger lige nu, uden at logge nogen
// ind: OAuth-klienter testes med en bevidst ugyldig kode — svarer udbyderen
// "ugyldig kode", er client ID + secret godkendt; svarer den "ugyldig
// klient", er de forkerte. Ingen nøgleværdier sendes tilbage til browseren.

export type CheckStatus = "ok" | "warn" | "fail" | "missing";
export type CheckResult = { status: CheckStatus; message: string };

const TIMEOUT_MS = 10_000;
const env = (key: string) => process.env[key]?.trim() || "";

function missing(keys: string[]): CheckResult | null {
  const absent = keys.filter((k) => !env(k));
  return absent.length ? { status: "missing", message: `Mangler: ${absent.join(", ")}` } : null;
}

function form(params: Record<string, string>) {
  return new URLSearchParams(params);
}

async function request(url: string | URL, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

async function readText(res: Response) {
  return (await res.text()).slice(0, 2000);
}

// Svarer udbyderen noget, der ligner "forkert klient", er nøglerne forkerte.
function looksLikeBadClient(status: number, body: string) {
  return status === 401 || /invalid[_ ]client|unauthorized_client|client id\/secret|"field":\s*"client_(id|secret)"|"resource":\s*"Application"/i.test(body);
}

async function oauthCodeProbe(name: string, url: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: form(params),
  });
  const body = await readText(res);
  if (looksLikeBadClient(res.status, body)) {
    return { status: "fail", message: `${name} afviser client ID eller secret.` } satisfies CheckResult;
  }
  return null;
}

function basic(id: string, secret: string) {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

// Googles login-side sender en fejlkode i authError, fx redirect_uri_mismatch.
async function googleRedirectProblem(clientId: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = form({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid" }).toString();
  const res = await request(url, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const authError = new URL(location, "https://accounts.google.com").searchParams.get("authError");
  if (!authError) return null;
  const decoded = Buffer.from(authError.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
  return decoded.match(/[a-z_]{6,}/)?.[0] ?? "ukendt fejl";
}

async function checkGoogleClient(prefix: string, redirectUris: string[]): Promise<CheckResult> {
  const id = env(`${prefix}_CLIENT_ID`);
  const secret = env(`${prefix}_CLIENT_SECRET`);
  const bad = await oauthCodeProbe("Google", "https://oauth2.googleapis.com/token", {
    code: "hellocal-test",
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUris[0] ?? "",
    grant_type: "authorization_code",
  });
  if (bad) return bad;
  for (const uri of redirectUris) {
    const problem = await googleRedirectProblem(id, uri);
    if (problem === "redirect_uri_mismatch") {
      return {
        status: "warn",
        message: `Nøglerne virker, men redirect-URI'en ${uri} er ikke registreret på OAuth-klienten i Google Cloud (Credentials → klienten → Authorized redirect URIs).`,
      };
    }
    if (problem) return { status: "fail", message: `Google afviser klienten: ${problem}` };
  }
  return { status: "ok", message: "Client ID, secret og redirect-URI godkendt af Google." };
}

async function checkFacebook(): Promise<CheckResult> {
  const url = new URL("https://graph.facebook.com/oauth/access_token");
  url.search = form({
    client_id: env("FACEBOOK_APP_ID"),
    client_secret: env("FACEBOOK_APP_SECRET"),
    grant_type: "client_credentials",
  }).toString();
  const res = await request(url);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
  if (!data.access_token) {
    return { status: "fail", message: `Facebook afviser App ID eller secret: ${data.error?.message ?? res.status}` };
  }
  const info = await request(
    `https://graph.facebook.com/v19.0/${env("FACEBOOK_APP_ID")}?fields=name,app_domains&access_token=${encodeURIComponent(data.access_token)}`
  );
  const app = (await info.json().catch(() => ({}))) as { name?: string; app_domains?: string[] };
  const domain = new URL(process.env.APP_BASE_URL || "https://hellocal.packroff.dk").hostname;
  if (app.app_domains && !app.app_domains.includes(domain)) {
    return {
      status: "warn",
      message: `Nøglerne virker (app “${app.name ?? "?"}”), men ${domain} står ikke under App Domains.`,
    };
  }
  return { status: "ok", message: `Nøglerne virker (app “${app.name ?? "?"}”). Husk at appen skal være “Live”.` };
}

async function checkApple(): Promise<CheckResult> {
  try {
    await importPKCS8(env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"), "ES256");
  } catch {
    return { status: "fail", message: "Den private nøgle kan ikke læses. Indsæt hele .p8-filen inkl. BEGIN/END-linjerne." };
  }
  return { status: "ok", message: "Nøglen kan læses. Apple kan kun testes helt ved et rigtigt login." };
}

async function checkWithings(redirectUris: string[]): Promise<CheckResult> {
  const res = await request("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    body: form({
      action: "requesttoken",
      grant_type: "authorization_code",
      client_id: env("WITHINGS_CLIENT_ID"),
      client_secret: env("WITHINGS_CLIENT_SECRET"),
      code: "hellocal-test",
      redirect_uri: redirectUris[0] ?? "",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (/client/i.test(data.error ?? "")) return { status: "fail", message: "Withings afviser client ID eller secret." };
  return { status: "ok", message: "Client ID og secret godkendt af Withings." };
}

async function checkSimpleOAuth(name: string, prefix: string, url: string, redirectUris: string[], useBasic: boolean) {
  const id = env(`${prefix}_CLIENT_ID`);
  const secret = env(`${prefix}_CLIENT_SECRET`);
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code: "hellocal-test",
    redirect_uri: redirectUris[0] ?? "",
  };
  if (!useBasic) Object.assign(params, { client_id: id, client_secret: secret });
  const bad = await oauthCodeProbe(name, url, params, useBasic ? { Authorization: basic(id, secret) } : {});
  return bad ?? ({ status: "ok", message: `Client ID og secret godkendt af ${name}.` } satisfies CheckResult);
}

async function checkOpenAI(): Promise<CheckResult> {
  const headers = { Authorization: `Bearer ${env("OPENAI_API_KEY")}` };
  const res = await request("https://api.openai.com/v1/models", { headers });
  if (!res.ok) return { status: "fail", message: `OpenAI afviser nøglen (${res.status}).` };
  const model = env("OPENAI_PRODUCT_VISION_MODEL");
  if (model) {
    const modelRes = await request(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers });
    if (!modelRes.ok) return { status: "warn", message: `Nøglen virker, men modellen “${model}” findes ikke på kontoen.` };
  }
  return { status: "ok", message: "Nøglen virker." };
}

async function checkPassio(): Promise<CheckResult> {
  const res = await request(`https://api.passiolife.com/v2/token-cache/unified/oauth/token/${encodeURIComponent(env("PASSIO_API_KEY"))}`, {
    method: "POST",
  });
  return res.ok ? { status: "ok", message: "Nøglen virker." } : { status: "fail", message: `Passio afviser nøglen (${res.status}).` };
}

async function checkUsda(): Promise<CheckResult> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.search = form({ query: "apple", pageSize: "1", api_key: env("USDA_FDC_API_KEY") }).toString();
  const res = await request(url);
  return res.ok ? { status: "ok", message: "Nøglen virker." } : { status: "fail", message: `USDA afviser nøglen (${res.status}).` };
}

async function checkPlaces(): Promise<CheckResult> {
  const res = await request("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env("GOOGLE_PLACES_API_KEY"),
      "X-Goog-FieldMask": "places.displayName",
    },
    body: JSON.stringify({ textQuery: "Netto Aarhus" }),
  });
  if (res.ok) return { status: "ok", message: "Nøglen virker (Places API (New))." };
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return { status: "fail", message: `Google afviser nøglen: ${data.error?.message?.slice(0, 200) ?? res.status}` };
}

async function checkSmtp(): Promise<CheckResult> {
  const port = Number(env("SMTP_PORT"));
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
  });
  try {
    await transport.verify();
  } catch (error) {
    return { status: "fail", message: `Mailserveren afviser login: ${error instanceof Error ? error.message.slice(0, 200) : "ukendt fejl"}` };
  }
  const from = env("SMTP_FROM");
  if (!/@[^@\s>]+\.[a-z]{2,}>?$/i.test(from)) {
    return { status: "warn", message: "Login virker, men afsenderadressen (SMTP_FROM) ser ugyldig ud." };
  }
  return { status: "ok", message: "Login til mailserveren virker. Afsenderdomænet skal være verificeret i Mailjet." };
}

async function checkPush(): Promise<CheckResult> {
  try {
    webpush.setVapidDetails(
      env("VAPID_CONTACT_EMAIL") || "mailto:admin@hellocal.local",
      env("VAPID_PUBLIC_KEY"),
      env("VAPID_PRIVATE_KEY")
    );
  } catch (error) {
    return { status: "fail", message: `Nøgleparret er ugyldigt: ${error instanceof Error ? error.message : "ukendt fejl"}` };
  }
  return { status: "ok", message: "Nøgleparret er gyldigt." };
}

// requiredKeys: de ikke-valgfrie felter fra kataloget.
export async function runCheck(serviceId: string, requiredKeys: string[], redirectUris: string[]): Promise<CheckResult> {
  const absent = missing(requiredKeys);
  if (absent) return absent;
  try {
    switch (serviceId) {
      case "google-login":
        return await checkGoogleClient("GOOGLE", redirectUris);
      case "google-health":
        return await checkGoogleClient("GOOGLE_HEALTH", redirectUris);
      case "facebook":
        return await checkFacebook();
      case "apple":
        return await checkApple();
      case "withings":
        return await checkWithings(redirectUris);
      case "strava":
        return await checkSimpleOAuth("Strava", "STRAVA", "https://www.strava.com/oauth/token", redirectUris, false);
      case "polar":
        return await checkSimpleOAuth("Polar", "POLAR", "https://polarremote.com/v2/oauth2/token", redirectUris, true);
      case "fitbit":
        return await checkSimpleOAuth("Fitbit", "FITBIT", "https://api.fitbit.com/oauth2/token", redirectUris, true);
      case "openai":
        return await checkOpenAI();
      case "passio":
        return await checkPassio();
      case "usda":
        return await checkUsda();
      case "google-places":
        return await checkPlaces();
      case "smtp":
        return await checkSmtp();
      case "push":
        return await checkPush();
      default:
        return { status: "missing", message: "Ingen test for denne tjeneste." };
    }
  } catch (error) {
    return { status: "fail", message: `Testen kunne ikke gennemføres: ${error instanceof Error ? error.message : "ukendt fejl"}` };
  }
}
