// Fælles visning for admin → API-forbrug og forsidens widget (må bruges i klienten).

export type UsageState = "ok" | "warn" | "fail" | "idle" | "missing";

export const STATE_LABEL: Record<UsageState, string> = {
  ok: "Kører",
  warn: "Advarsel",
  fail: "Fejl",
  idle: "Ingen kald",
  missing: "Ikke sat op",
};

export const STATE_CHIP: Record<UsageState, string> = {
  ok: "bg-hf-green-light text-hf-green-dark",
  warn: "bg-hf-warning-bg text-hf-warning",
  fail: "bg-hf-red-dark text-hf-white",
  idle: "bg-hf-tan text-text-secondary",
  missing: "bg-hf-tan text-text-secondary",
};

export const STATE_BAR: Record<UsageState, string> = {
  ok: "bg-hf-green",
  warn: "bg-hf-warning",
  fail: "bg-hf-red-dark",
  idle: "bg-hf-green",
  missing: "bg-hf-tan-dark",
};

export function formatMoney(value: number | null, currency: "USD" | "DKK") {
  if (value === null) return "–";
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPrice(value: number | null, currency: "USD" | "DKK") {
  if (value === null) return "–";
  return `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 4 }).format(value)} ${currency === "USD" ? "$" : "kr."}`;
}
