import type { IntegrationCardStatus } from "@/lib/integrations";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

// Status på integrationens egen side (i18n-nøgle under integrations.status).
// En companion-integration (Apple Health/Health Connect) er "Forbundet", når
// Hello Cal-appen har sendt data; ellers "Kræver app".
export function integrationStatusKey(integration: IntegrationCardStatus) {
  if (integration.kind === "unavailable") return "pending";
  if (integration.status === "CONNECTED") return "connected";
  if (integration.status === "ERROR") return "error";
  return integration.kind === "companion" ? "needsApp" : "disconnected";
}
