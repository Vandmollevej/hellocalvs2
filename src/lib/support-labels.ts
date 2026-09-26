// Visningstekster til Support-indbakken i admin (docs/DECISIONS.md 2026-09-26).

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  ACCOUNT: "Konto og login",
  DATA: "Mine data",
  PRODUCTS: "Produkter og søgning",
  PAYMENT: "Abonnement og betaling",
  BUG: "Fejl i appen",
  OTHER: "Andet",
};

export const SUPPORT_PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Høj",
  NORMAL: "Normal",
  LOW: "Lav",
};

// "3 t 20 min", "2 d 4 t" — hvor længe en besked har ventet.
export function formatWaiting(from: Date, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} t`;
}

export function formatAdminTime(date: Date) {
  return date.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });
}
