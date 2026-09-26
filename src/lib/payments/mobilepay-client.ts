import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Klient til Vipps MobilePay's Recurring API v3 + Webhooks API v1
// (docs/DECISIONS.md 2026-09-26). Nøglerne kommer fra MobilePay-portalen
// (portal.vippsmobilepay.com → Udvikler → API-nøgler) og kan rettes i
// admin → API-nøgler. Ingen kortdata passerer Hello Cal: brugeren godkender
// aftalen i MobilePay-appen, og vi gemmer kun aftale- og træk-id'er.

const TIMEOUT_MS = 15_000;

const env = (key: string) => process.env[key]?.trim() || "";

export const MOBILEPAY_REQUIRED_KEYS = [
  "MOBILEPAY_CLIENT_ID",
  "MOBILEPAY_CLIENT_SECRET",
  "MOBILEPAY_SUBSCRIPTION_KEY",
  "MOBILEPAY_MERCHANT_SERIAL_NUMBER",
];

export function isMobilePayConfigured() {
  return MOBILEPAY_REQUIRED_KEYS.every((key) => env(key));
}

// MOBILEPAY_ENV=test bruger testmiljøet (apitest.vipps.no); alt andet er produktion.
function apiBase() {
  return env("MOBILEPAY_ENV") === "test" ? "https://apitest.vipps.no" : "https://api.vipps.no";
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || "https://hellocal.packroff.dk").replace(/\/$/, "");
}

export class MobilePayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

const tokenCache = globalThis as typeof globalThis & {
  __helloCalMobilePayToken?: { token: string; expiresAt: number; keyFingerprint: string };
};

// Skifter nøglerne i admin, må et gammelt token ikke genbruges.
function keyFingerprint() {
  return createHash("sha256")
    .update(MOBILEPAY_REQUIRED_KEYS.map(env).join("|") + env("MOBILEPAY_ENV"))
    .digest("hex");
}

function systemHeaders() {
  return {
    "Ocp-Apim-Subscription-Key": env("MOBILEPAY_SUBSCRIPTION_KEY"),
    "Merchant-Serial-Number": env("MOBILEPAY_MERCHANT_SERIAL_NUMBER"),
    "Vipps-System-Name": "hello-cal",
    "Vipps-System-Version": "1.0.0",
    "Vipps-System-Plugin-Name": "hello-cal-recurring",
    "Vipps-System-Plugin-Version": "1.0.0",
  };
}

export async function getAccessToken(): Promise<string> {
  const fingerprint = keyFingerprint();
  const cached = tokenCache.__helloCalMobilePayToken;
  if (cached && cached.keyFingerprint === fingerprint && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const res = await fetch(`${apiBase()}/accesstoken/get`, {
    method: "POST",
    headers: {
      client_id: env("MOBILEPAY_CLIENT_ID"),
      client_secret: env("MOBILEPAY_CLIENT_SECRET"),
      ...systemHeaders(),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) throw new MobilePayError(`MobilePay afviste nøglerne (${res.status})`, res.status, body);
  const json = JSON.parse(body) as { access_token: string; expires_in: string | number };
  const expiresIn = Number(json.expires_in) || 3600;
  tokenCache.__helloCalMobilePayToken = {
    token: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    keyFingerprint: fingerprint,
  };
  return json.access_token;
}

async function call<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  { body, idempotencyKey }: { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...systemHeaders(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["Idempotency-Key"] = idempotencyKey ?? randomUUID();
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new MobilePayError(`MobilePay ${method} ${path} fejlede (${res.status})`, res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

// ---- Recurring API v3 ----------------------------------------------------

export type AgreementStatus = "PENDING" | "ACTIVE" | "STOPPED" | "EXPIRED";

export type Agreement = {
  id: string;
  status: AgreementStatus;
  pricing?: { type?: string; amount?: number; currency?: string };
  interval?: { unit?: string; count?: number };
  productName?: string;
  start?: string | null;
  stop?: string | null;
};

export type ChargeStatus =
  | "PENDING"
  | "DUE"
  | "RESERVED"
  | "CHARGED"
  | "PARTIALLY_CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "PROCESSING";

export type Charge = {
  id: string;
  status: ChargeStatus;
  amount: number;
  due: string;
  failureReason?: string | null;
};

export async function createAgreement(input: {
  amountOre: number;
  intervalMonths: number;
  productName: string;
  productDescription: string;
  merchantRedirectUrl: string;
  merchantAgreementUrl: string;
  externalId: string;
  initialCharge?: { amountOre: number; description: string; orderId: string };
  idempotencyKey: string;
}) {
  return call<{ agreementId: string; vippsConfirmationUrl: string; chargeId?: string }>(
    "POST",
    "/recurring/v3/agreements",
    {
      idempotencyKey: input.idempotencyKey,
      body: {
        pricing: { type: "LEGACY", amount: input.amountOre, currency: "DKK" },
        interval: { unit: "MONTH", count: input.intervalMonths },
        merchantRedirectUrl: input.merchantRedirectUrl,
        merchantAgreementUrl: input.merchantAgreementUrl,
        productName: input.productName,
        productDescription: input.productDescription,
        externalId: input.externalId,
        ...(input.initialCharge
          ? {
              initialCharge: {
                amount: input.initialCharge.amountOre,
                description: input.initialCharge.description,
                transactionType: "DIRECT_CAPTURE",
                orderId: input.initialCharge.orderId,
              },
            }
          : {}),
      },
    },
  );
}

export function getAgreement(agreementId: string) {
  return call<Agreement>("GET", `/recurring/v3/agreements/${encodeURIComponent(agreementId)}`);
}

export function stopAgreement(agreementId: string) {
  return call<unknown>("PATCH", `/recurring/v3/agreements/${encodeURIComponent(agreementId)}`, {
    body: { status: "STOPPED" },
  });
}

export function createCharge(
  agreementId: string,
  input: { amountOre: number; description: string; due: string; orderId: string; retryDays: number },
) {
  return call<{ chargeId: string }>("POST", `/recurring/v3/agreements/${encodeURIComponent(agreementId)}/charges`, {
    idempotencyKey: input.orderId,
    body: {
      amount: input.amountOre,
      transactionType: "DIRECT_CAPTURE",
      description: input.description,
      due: input.due,
      retryDays: input.retryDays,
      orderId: input.orderId,
    },
  });
}

export function getCharge(agreementId: string, chargeId: string) {
  return call<Charge>(
    "GET",
    `/recurring/v3/agreements/${encodeURIComponent(agreementId)}/charges/${encodeURIComponent(chargeId)}`,
  );
}

export function cancelCharge(agreementId: string, chargeId: string) {
  return call<unknown>(
    "DELETE",
    `/recurring/v3/agreements/${encodeURIComponent(agreementId)}/charges/${encodeURIComponent(chargeId)}`,
  );
}

// ---- Webhooks API v1 -----------------------------------------------------

export const MOBILEPAY_WEBHOOK_EVENTS = [
  "recurring.agreement-activated.v1",
  "recurring.agreement-rejected.v1",
  "recurring.agreement-stopped.v1",
  "recurring.agreement-expired.v1",
  "recurring.charge-reserved.v1",
  "recurring.charge-captured.v1",
  "recurring.charge-canceled.v1",
  "recurring.charge-failed.v1",
  "recurring.charge-creation-failed.v1",
];

export function listWebhooks() {
  return call<{ webhooks: Array<{ id: string; url: string; events: string[] }> }>("GET", "/webhooks/v1/webhooks");
}

export function registerWebhook(url: string) {
  return call<{ id: string; secret: string }>("POST", "/webhooks/v1/webhooks", {
    body: { url, events: MOBILEPAY_WEBHOOK_EVENTS },
  });
}

export function deleteWebhook(id: string) {
  return call<unknown>("DELETE", `/webhooks/v1/webhooks/${encodeURIComponent(id)}`);
}

// Vipps MobilePay signerer webhooks med HMAC-SHA256 over
// "POST\n<sti+query>\n<x-ms-date>;<host>;<x-ms-content-sha256>".
export function verifyWebhookSignature(input: {
  secret: string;
  pathAndQuery: string;
  host: string;
  rawBody: string;
  date: string | null;
  contentSha256: string | null;
  authorization: string | null;
}) {
  if (!input.date || !input.contentSha256 || !input.authorization) return false;
  const expectedHash = createHash("sha256").update(input.rawBody, "utf8").digest("base64");
  if (!safeEqual(expectedHash, input.contentSha256)) return false;
  const toSign = `POST\n${input.pathAndQuery}\n${input.date};${input.host};${input.contentSha256}`;
  const signature = createHmac("sha256", input.secret).update(toSign, "utf8").digest("base64");
  return safeEqual(
    `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    input.authorization,
  );
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
