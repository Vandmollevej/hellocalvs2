import { ensureSecretsLoaded, saveSecret } from "@/lib/api-keys/store";

// Admin → OpenAI (docs/DECISIONS.md 2026-10-16): status på API-nøglen,
// forbruget i dollar og den resterende kredit. OpenAI har intet API til
// kreditsaldoen, så admin skriver saldoen ind (fra Billing-siden), og
// forbruget efter den dato trækkes fra. Forbruget kræver en admin-nøgle
// (OPENAI_ADMIN_KEY) — den almindelige API-nøgle må ikke læse det.

const TIMEOUT_MS = 10_000;
const STATUS_CACHE_MS = 60_000;
const DAY_S = 86_400;
export const LOW_BALANCE_USD = 5;

export type KeyStatus =
  | { state: "ok"; message: string }
  | { state: "quota"; message: string }
  | { state: "rate-limited"; message: string }
  | { state: "invalid"; message: string }
  | { state: "missing"; message: string }
  | { state: "error"; message: string };

export type DayCost = { date: string; usd: number };
export type LineCost = { name: string; usd: number };

export type OpenAiUsage = {
  checkedAt: string;
  status: KeyStatus;
  costs:
    | { available: false; message: string }
    | {
        available: true;
        todayUsd: number;
        last7Usd: number;
        monthUsd: number;
        days: DayCost[];
        lines: LineCost[];
      };
  balance:
    | { configured: false }
    | {
        configured: true;
        enteredUsd: number;
        enteredAt: string;
        spentSinceUsd: number | null;
        remainingUsd: number | null;
        low: boolean;
      };
};

const env = (key: string) => process.env[key]?.trim() || "";

async function request(url: string, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

// Et bittelille kald (16 tokens svar) — det eneste, der afslører, om
// kreditten er brugt op: OpenAI svarer da 429 med koden insufficient_quota.
let statusCache: { at: number; key: string; value: KeyStatus } | null = null;

export async function probeKeyStatus(force = false): Promise<KeyStatus> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return { state: "missing", message: "OPENAI_API_KEY er ikke sat." };
  if (!force && statusCache && statusCache.key === apiKey && Date.now() - statusCache.at < STATUS_CACHE_MS) {
    return statusCache.value;
  }
  let value: KeyStatus;
  try {
    const res = await request("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o-mini", input: "ok", max_output_tokens: 16, store: false }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; type?: string; message?: string } };
    const code = body.error?.code ?? body.error?.type ?? "";
    if (res.ok) value = { state: "ok", message: "Nøglen virker, og der er kredit." };
    else if (code === "insufficient_quota" || /quota|billing/i.test(body.error?.message ?? "")) {
      value = { state: "quota", message: "Kreditten er brugt op — alle AI-kald fejler, indtil der fyldes op." };
    } else if (res.status === 429) value = { state: "rate-limited", message: "OpenAI begrænser kaldene lige nu (for mange pr. minut)." };
    else if (res.status === 401 || res.status === 403) value = { state: "invalid", message: `OpenAI afviser nøglen (${res.status}).` };
    else value = { state: "error", message: `OpenAI svarede ${res.status}${body.error?.message ? `: ${body.error.message.slice(0, 200)}` : ""}.` };
  } catch {
    value = { state: "error", message: "OpenAI svarede ikke." };
  }
  statusCache = { at: Date.now(), key: apiKey, value };
  return value;
}

type CostPage = {
  data?: { start_time: number; results?: { amount?: { value?: number | string }; line_item?: string | null }[] }[];
  has_more?: boolean;
  next_page?: string | null;
};

// OpenAI opdaterer forbruget med minutters forsinkelse; forsiden og
// varsel-jobbet læser det ofte, så svaret genbruges i 5 minutter.
const COSTS_CACHE_MS = 5 * 60_000;
let costsCache: { at: number; key: string; value: Awaited<ReturnType<typeof fetchCostBucketsLive>> } | null = null;

async function fetchCostBuckets(adminKey: string, startTime: number) {
  const key = `${adminKey}:${startTime}`;
  if (costsCache && costsCache.key === key && Date.now() - costsCache.at < COSTS_CACHE_MS) return costsCache.value;
  const value = await fetchCostBucketsLive(adminKey, startTime);
  costsCache = { at: Date.now(), key, value };
  return value;
}

// Dagligt forbrug fra Costs-API'et (UTC-døgn), opdelt på linjer (model/type).
async function fetchCostBucketsLive(adminKey: string, startTime: number) {
  const buckets: { start: number; usd: number; lines: Map<string, number> }[] = [];
  let page: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "180");
    url.searchParams.append("group_by", "line_item");
    if (page) url.searchParams.set("page", page);
    const res = await request(url.toString(), { headers: { Authorization: `Bearer ${adminKey}` } });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Admin-nøglen afvises af OpenAI." : `OpenAI svarede ${res.status}.`);
    const body = (await res.json()) as CostPage;
    for (const b of body.data ?? []) {
      const lines = new Map<string, number>();
      let usd = 0;
      for (const r of b.results ?? []) {
        const value = Number(r.amount?.value ?? 0) || 0;
        usd += value;
        const name = r.line_item || "Andet";
        lines.set(name, (lines.get(name) ?? 0) + value);
      }
      buckets.push({ start: b.start_time, usd, lines });
    }
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return buckets.sort((a, b) => a.start - b.start);
}

function utcDayStart(date: Date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000);
}

export function readBalance(): { usd: number; at: Date } | null {
  const usd = Number(env("OPENAI_CREDIT_BALANCE_USD").replace(",", "."));
  const at = new Date(env("OPENAI_CREDIT_BALANCE_AT"));
  if (!Number.isFinite(usd) || !env("OPENAI_CREDIT_BALANCE_USD") || Number.isNaN(at.getTime())) return null;
  return { usd, at };
}

export async function saveBalance(usd: number, adminId: string, now = new Date()) {
  await ensureSecretsLoaded();
  await saveSecret("OPENAI_CREDIT_BALANCE_USD", String(Math.round(usd * 100) / 100), adminId);
  await saveSecret("OPENAI_CREDIT_BALANCE_AT", now.toISOString(), adminId);
}

export async function getOpenAiUsage(
  now = new Date(),
  forceStatus = false,
  lowBalanceUsd = LOW_BALANCE_USD,
): Promise<OpenAiUsage> {
  await ensureSecretsLoaded();
  const balance = readBalance();
  const todayStart = utcDayStart(now);
  const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  // Forbruget på saldoens dag tælles fra næste døgn: Costs-API'et deler kun
  // op i hele UTC-døgn, og saldoen fra Billing-siden indeholder allerede
  // dagens forbrug indtil da.
  const balanceFrom = balance ? utcDayStart(balance.at) + DAY_S : null;
  const startTime = Math.min(monthStart, todayStart - 29 * DAY_S, balanceFrom ?? Infinity);

  const adminKey = env("OPENAI_ADMIN_KEY");
  const [status, costs] = await Promise.all([
    probeKeyStatus(forceStatus),
    adminKey
      ? fetchCostBuckets(adminKey, startTime).then(
          (buckets) => ({ ok: true as const, buckets }),
          (error: unknown) => ({ ok: false as const, message: error instanceof Error ? error.message : "Forbruget kunne ikke hentes." }),
        )
      : Promise.resolve({ ok: false as const, message: "Sæt en OpenAI admin-nøgle på API-nøgler for at se forbruget." }),
  ]);

  const round = (n: number) => Math.round(n * 100) / 100;
  let costPart: OpenAiUsage["costs"];
  let spentSince: number | null = null;
  if (costs.ok) {
    const sum = (from: number) => costs.buckets.filter((b) => b.start >= from).reduce((s, b) => s + b.usd, 0);
    const lineTotals = new Map<string, number>();
    for (const b of costs.buckets.filter((x) => x.start >= monthStart)) {
      for (const [name, usd] of b.lines) lineTotals.set(name, (lineTotals.get(name) ?? 0) + usd);
    }
    costPart = {
      available: true,
      todayUsd: round(sum(todayStart)),
      last7Usd: round(sum(todayStart - 6 * DAY_S)),
      monthUsd: round(sum(monthStart)),
      days: costs.buckets
        .filter((b) => b.start >= todayStart - 29 * DAY_S)
        .map((b) => ({ date: new Date(b.start * 1000).toISOString().slice(0, 10), usd: round(b.usd) })),
      lines: [...lineTotals]
        .map(([name, usd]) => ({ name, usd: round(usd) }))
        .filter((l) => l.usd > 0)
        .sort((a, b) => b.usd - a.usd),
    };
    if (balanceFrom !== null) spentSince = round(sum(balanceFrom));
  } else {
    costPart = { available: false, message: costs.message };
  }

  const remaining = balance && spentSince !== null ? round(balance.usd - spentSince) : null;
  return {
    checkedAt: now.toISOString(),
    status,
    costs: costPart,
    balance: balance
      ? {
          configured: true,
          enteredUsd: balance.usd,
          enteredAt: balance.at.toISOString(),
          spentSinceUsd: spentSince,
          remainingUsd: remaining,
          low: status.state === "quota" || (remaining !== null && remaining < lowBalanceUsd),
        }
      : { configured: false },
  };
}
