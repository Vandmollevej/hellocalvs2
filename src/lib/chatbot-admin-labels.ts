// Visningstekster til admin → Brugere → Chatbot (docs/DECISIONS.md 2026-10-02).

export function sexLabel(sex: string | null | undefined) {
  if (sex === "FEMALE") return "Kvinde";
  if (sex === "MALE") return "Mand";
  return "Køn ukendt";
}

export function tierLabel(tier: string | null | undefined, plan?: string | null) {
  if (tier === "SERIOUS") return plan === "FAMILY" ? "Seriøs Familie" : "Seriøs";
  return "Gratis";
}

export function regionLabel(region: string | null | undefined) {
  if (!region) return "Region ukendt";
  try {
    return new Intl.DisplayNames(["da"], { type: "region" }).of(region.toUpperCase()) ?? region;
  } catch {
    return region;
  }
}

export function ageLabel(age: number | null | undefined) {
  return typeof age === "number" ? `${age} år` : "Alder ukendt";
}

export function localeLabel(locale: string | null | undefined) {
  return locale === "en" ? "Engelsk" : "Dansk";
}

export function channelLabel(channel: string | null | undefined) {
  return channel === "WEB" ? "Web" : "App";
}

export function subscriptionStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "TRIALING":
      return "Prøveperiode";
    case "FREE_MONTH":
      return "Gratis måned";
    case "CANCELED":
      return "Opsagt";
    default:
      return "Intet abonnement";
  }
}
