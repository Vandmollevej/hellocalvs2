// Fitbit Web API (OAuth2, dokumenteret på dev.fitbit.com). Brugeren opretter
// selv en app på https://dev.fitbit.com/apps/new og sætter FITBIT_CLIENT_ID/
// FITBIT_CLIENT_SECRET samt INTEGRATIONS_REDIRECT_BASE_URL i .env.production.

const AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const SCOPES = "activity weight profile";

function redirectUri() {
  const base = process.env.INTEGRATIONS_REDIRECT_BASE_URL;
  if (!base) throw new Error("INTEGRATIONS_REDIRECT_BASE_URL er ikke sat");
  return `${base.replace(/\/$/, "")}/api/integrations/fitbit/callback`;
}

export function isFitbitConfigured() {
  return Boolean(process.env.FITBIT_CLIENT_ID && process.env.FITBIT_CLIENT_SECRET);
}

export function buildFitbitAuthorizeUrl(state: string) {
  const clientId = process.env.FITBIT_CLIENT_ID;
  if (!clientId) throw new Error("FITBIT_CLIENT_ID er ikke sat");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

type FitbitTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user_id: string;
};

function basicAuthHeader() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Fitbit-klientoplysninger mangler");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeFitbitCode(code: string): Promise<FitbitTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.FITBIT_CLIENT_ID ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Fitbit token-udveksling fejlede (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

export async function refreshFitbitToken(refreshToken: string): Promise<FitbitTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    throw new Error(`Fitbit token-fornyelse fejlede (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export type FitbitActivityLog = {
  activityName: string;
  startTime: string;
  duration: number; // ms
  calories: number;
  originalStartTime: string;
};

// Loggede træningspas (ikke den daglige aktivitetsopsummering) — mapper 1:1
// til vores Activity-model (sportType/startedAt/durationMinutes/caloriesBurned).
export async function fetchFitbitActivityLogs(accessToken: string, afterDate: Date) {
  const url = new URL("https://api.fitbit.com/1/user/-/activities/list.json");
  url.searchParams.set("afterDate", formatDate(afterDate));
  url.searchParams.set("sort", "asc");
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`Fitbit aktivitets-opslag fejlede (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { activities?: FitbitActivityLog[] };
  return data.activities ?? [];
}

export type FitbitWeightLog = {
  date: string;
  time: string;
  weight: number; // kg, når brugerens Fitbit-konto er sat til metrisk
};

export async function fetchFitbitWeightLogs(accessToken: string, baseDate: Date, endDate: Date) {
  const url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${formatDate(baseDate)}/${formatDate(endDate)}.json`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new Error(`Fitbit vægt-opslag fejlede (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as { weight?: FitbitWeightLog[] };
  return data.weight ?? [];
}
