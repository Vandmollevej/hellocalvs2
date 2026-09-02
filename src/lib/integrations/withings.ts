// Withings Health API (OAuth2, documented at developer.withings.com).
// The user creates their own app at https://developer.withings.com/dashboard
// and sets WITHINGS_CLIENT_ID/WITHINGS_CLIENT_SECRET as well as
// INTEGRATIONS_REDIRECT_BASE_URL in .env.production. Used exclusively for
// weight (smart scale), per docs/DECISIONS.md.

const AUTHORIZE_URL = "https://account.withings.com/oauth2_user/authorize2";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";
const SCOPES = "user.metrics";

function redirectUri() {
  const base = process.env.INTEGRATIONS_REDIRECT_BASE_URL;
  if (!base) throw new Error("INTEGRATIONS_REDIRECT_BASE_URL er ikke sat");
  return `${base.replace(/\/$/, "")}/api/integrations/withings/callback`;
}

export function isWithingsConfigured() {
  return Boolean(process.env.WITHINGS_CLIENT_ID && process.env.WITHINGS_CLIENT_SECRET);
}

export function buildWithingsAuthorizeUrl(state: string) {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  if (!clientId) throw new Error("WITHINGS_CLIENT_ID er ikke sat");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", redirectUri());
  return url.toString();
}

type WithingsTokenBody = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  userid: string;
};

type WithingsEnvelope<T> = { status: number; body: T; error?: string };

async function callWithingsOAuth<T>(params: Record<string, string>): Promise<T> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.WITHINGS_CLIENT_ID ?? "",
      client_secret: process.env.WITHINGS_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  if (!response.ok) {
    throw new Error(`Withings-kald fejlede (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as WithingsEnvelope<T>;
  if (data.status !== 0) {
    throw new Error(`Withings returnerede status ${data.status}: ${data.error ?? "ukendt fejl"}`);
  }
  return data.body;
}

export async function exchangeWithingsCode(code: string): Promise<WithingsTokenBody> {
  return callWithingsOAuth<WithingsTokenBody>({
    action: "requesttoken",
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
}

export async function refreshWithingsToken(refreshToken: string): Promise<WithingsTokenBody> {
  return callWithingsOAuth<WithingsTokenBody>({
    action: "requesttoken",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// Withings' own "meastype" for weight is 1; the unit is value * 10^unit kg.
type WithingsMeasureGroup = {
  date: number; // unix-sekunder
  measures: { value: number; type: number; unit: number }[];
};

export async function fetchWithingsWeightMeasurements(accessToken: string, sinceUnixSeconds: number) {
  const response = await fetch(MEASURE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "getmeas",
      meastype: "1",
      category: "1",
      lastupdate: String(sinceUnixSeconds),
    }),
  });
  if (!response.ok) {
    throw new Error(`Withings vægt-opslag fejlede (${response.status}): ${await response.text()}`);
  }
  const data = (await response.json()) as WithingsEnvelope<{ measuregrps?: WithingsMeasureGroup[] }>;
  if (data.status !== 0) {
    throw new Error(`Withings returnerede status ${data.status}`);
  }

  const groups = data.body.measuregrps ?? [];
  return groups
    .map((group) => {
      const weightMeasure = group.measures.find((m) => m.type === 1);
      if (!weightMeasure) return null;
      const weightKg = weightMeasure.value * Math.pow(10, weightMeasure.unit);
      return { weighedAt: new Date(group.date * 1000), weightKg };
    })
    .filter((entry): entry is { weighedAt: Date; weightKg: number } => entry !== null);
}
