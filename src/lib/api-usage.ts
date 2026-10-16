import { prisma } from "@/lib/prisma";
import { ensureSecretsLoaded } from "@/lib/api-keys/store";
import { getOpenAiUsage, type OpenAiUsage } from "@/lib/openai-usage";
import { monthKey } from "@/lib/api-usage-record";
import type { UsageState } from "@/lib/api-usage-format";

// Admin → API-forbrug (docs/DECISIONS.md 2026-10-16): status, månedens
// forbrug og budget for hver tjeneste, der koster penge. OpenAI læses live
// fra udbyderen; de øvrige har intet forbrugs-API, vi kan bruge, så appen
// tæller selv sine kald (recordApiCall), og forbruget = kald × pris pr. kald.

import type { PaidServiceId } from "@/lib/api-usage-record";

export type { PaidServiceId };

export type PaidService = {
  id: PaidServiceId;
  name: string;
  /** Logo i public/api-logos/<logo>.png og kortet på admin → API-nøgler. */
  logo: string;
  currency: "USD" | "DKK";
  /** Nøgler, der skal være sat, før tjenesten er i brug (én af grupperne).
   *  null = nøglen ligger kun i en robots container, så appen kan ikke se den. */
  keys: string[][] | null;
  /** Standardpris pr. kald (kan rettes på siden). null = forbruget hentes live. */
  defaultUnitPrice: number | null;
  priceNote: string;
  billingUrl: string;
};

export const PAID_SERVICES: PaidService[] = [
  {
    id: "openai",
    name: "OpenAI",
    logo: "openai",
    currency: "USD",
    keys: [["OPENAI_API_KEY"]],
    defaultUnitPrice: null,
    priceNote: "Forbruget hentes live fra OpenAI (kræver admin-nøgle).",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
  },
  {
    id: "google-places",
    name: "Google Places",
    logo: "google-places",
    currency: "USD",
    keys: [["GOOGLE_PLACES_API_KEY"]],
    defaultUnitPrice: 0.032,
    priceNote: "Nearby Search (Pro) koster 32 $ pr. 1.000 kald; Google giver et gratis månedligt antal.",
    billingUrl: "https://console.cloud.google.com/billing",
  },
  {
    id: "google-vision",
    name: "Google Vision",
    logo: "google-places",
    currency: "USD",
    keys: null,
    defaultUnitPrice: 0.0015,
    priceNote: "Logo-robotten: 1,50 $ pr. 1.000 billeder (de første 1.000 om måneden er gratis). Tælles pr. billede.",
    billingUrl: "https://console.cloud.google.com/billing",
  },
  {
    id: "google-search",
    name: "Google Custom Search",
    logo: "google-places",
    currency: "USD",
    keys: null,
    defaultUnitPrice: 0.005,
    priceNote: "Billedrobottens billedsøgning: 5 $ pr. 1.000 søgninger ud over 100 gratis om dagen.",
    billingUrl: "https://console.cloud.google.com/billing",
  },
  {
    id: "bria",
    name: "Bria",
    logo: "bria",
    currency: "USD",
    keys: [["BRIA_API_TOKEN"]],
    defaultUnitPrice: 0.02,
    priceNote: "Pris pr. fritlægning — ret den til din Bria-aftale.",
    billingUrl: "https://platform.bria.ai",
  },
  {
    id: "passio",
    name: "Passio",
    logo: "passio",
    currency: "USD",
    keys: [["PASSIO_API_KEY"]],
    defaultUnitPrice: 0.01,
    priceNote: "Pris pr. billedgenkendelse — ret den til din Passio-aftale.",
    billingUrl: "https://accounts.passiolife.com",
  },
  {
    id: "sms",
    name: "SMS",
    logo: "teammessage",
    currency: "DKK",
    keys: [["TEAMMESSAGE_API_TOKEN"], ["SMS_GATEWAY_TOKEN"]],
    defaultUnitPrice: 0.3,
    priceNote: "Pris pr. sms (TeamMessage/GatewayAPI).",
    billingUrl: "https://teammessage.dk",
  },
  {
    id: "smtp",
    name: "Mailjet",
    logo: "smtp",
    currency: "USD",
    keys: [["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]],
    defaultUnitPrice: 0,
    priceNote: "Gratis op til 6.000 mails om måneden; sæt en pris, hvis I betaler pr. mail.",
    billingUrl: "https://app.mailjet.com/account/billing",
  },
];

export type ServiceState = UsageState;

export type ServiceOverview = {
  id: PaidServiceId;
  name: string;
  logo: string;
  currency: "USD" | "DKK";
  state: ServiceState;
  stateText: string;
  configured: boolean;
  calls: number | null;
  errors: number | null;
  spent: number | null;
  spentNote: string | null;
  budget: number | null;
  unitPrice: number | null;
  defaultUnitPrice: number | null;
  /** Andel af budgettet brugt (0–1+), null uden budget eller forbrug. */
  budgetUse: number | null;
  priceNote: string;
  billingUrl: string;
};

export type ApiUsageOverview = {
  checkedAt: string;
  month: string;
  services: ServiceOverview[];
  openai: OpenAiUsage;
};

export const BUDGET_WARN = 0.8;

function isConfigured(service: PaidService) {
  if (service.keys === null) return true;
  return service.keys.some((group) => group.every((key) => Boolean(process.env[key]?.trim())));
}

const round = (n: number) => Math.round(n * 100) / 100;

function budgetState(use: number | null): { state: ServiceState; text: string } | null {
  if (use === null) return null;
  if (use >= 1) return { state: "fail", text: "Budgettet er brugt op" };
  if (use >= BUDGET_WARN) return { state: "warn", text: `${Math.round(use * 100)} % af budgettet er brugt` };
  return null;
}

export async function getApiUsageOverview(now = new Date(), forceStatus = false): Promise<ApiUsageOverview> {
  await ensureSecretsLoaded();
  const month = monthKey(now);
  const [usageRows, budgetRows, openai] = await Promise.all([
    prisma.apiUsageMonth.findMany({ where: { month } }),
    prisma.apiBudget.findMany(),
    getOpenAiUsage(now, forceStatus),
  ]);
  const usage = new Map(usageRows.map((r) => [r.serviceId, r]));
  const budgets = new Map(budgetRows.map((r) => [r.serviceId, r]));

  const services = PAID_SERVICES.map((service): ServiceOverview => {
    const configured = isConfigured(service);
    const budgetRow = budgets.get(service.id);
    const budget = budgetRow?.monthlyBudget ?? null;
    const unitPrice = service.defaultUnitPrice === null ? null : (budgetRow?.unitPrice ?? service.defaultUnitPrice);
    const row = usage.get(service.id);
    const base = {
      id: service.id,
      name: service.name,
      logo: service.logo,
      currency: service.currency,
      configured,
      budget,
      unitPrice,
      defaultUnitPrice: service.defaultUnitPrice,
      priceNote: service.priceNote,
      billingUrl: service.billingUrl,
    };

    if (service.id === "openai") {
      const spent = openai.costs.available ? openai.costs.monthUsd : null;
      const use = spent !== null && budget ? spent / budget : null;
      const s = openai.status;
      let state: ServiceState =
        s.state === "ok" ? "ok" : s.state === "missing" ? "missing" : s.state === "rate-limited" || s.state === "error" ? "warn" : "fail";
      let stateText = s.message;
      if (openai.balance.configured && openai.balance.low && state === "ok") {
        state = "warn";
        stateText = "Lav kreditsaldo — fyld op hos OpenAI";
      }
      const overBudget = state === "ok" ? budgetState(use) : null;
      if (overBudget) ({ state, text: stateText } = overBudget);
      return {
        ...base,
        state,
        stateText,
        calls: null,
        errors: null,
        spent,
        spentNote: openai.costs.available ? null : openai.costs.message,
        budgetUse: use,
      };
    }

    const calls = row?.calls ?? 0;
    const spent = unitPrice === null ? null : round(calls * unitPrice);
    const use = spent !== null && budget ? spent / budget : null;
    let state: ServiceState;
    let stateText: string;
    if (!configured) {
      state = "missing";
      stateText = "Ingen nøgle — tjenesten er ikke i brug.";
    } else if (row?.lastErrorAt && (!row.lastOkAt || row.lastErrorAt > row.lastOkAt)) {
      state = "fail";
      stateText = `Seneste kald fejlede: ${row.lastError ?? "ukendt fejl"}`;
    } else if (!row) {
      state = "idle";
      stateText = "Ingen kald denne måned.";
    } else {
      state = "ok";
      stateText = "Seneste kald lykkedes.";
    }
    const overBudget = state === "ok" || state === "idle" ? budgetState(use) : null;
    if (overBudget) ({ state, text: stateText } = overBudget);
    return { ...base, state, stateText, calls, errors: row?.errors ?? 0, spent, spentNote: null, budgetUse: use };
  });

  return { checkedAt: now.toISOString(), month, services, openai };
}

export async function saveBudget(serviceId: string, monthlyBudget: number | null, unitPrice: number | null) {
  const service = PAID_SERVICES.find((s) => s.id === serviceId);
  if (!service) throw new Error("Ukendt tjeneste");
  const price = service.defaultUnitPrice === null ? null : unitPrice;
  await prisma.apiBudget.upsert({
    where: { serviceId },
    create: { serviceId, monthlyBudget, unitPrice: price },
    update: { monthlyBudget, unitPrice: price },
  });
}
