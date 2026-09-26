"use client";

import type { IntegrationCardStatus } from "@/lib/integrations";
import { useTranslation } from "@/i18n/LocaleProvider";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}

// Status på integrationslisten og på integrationens egen side. En
// companion-integration (Apple Health/Health Connect) er "Forbundet", når
// Hello Cal-appen har sendt data; ellers "Kræver app".
export function IntegrationStatusBadge({ integration }: { integration: IntegrationCardStatus }) {
  const { t } = useTranslation();
  const [label, style] =
    integration.kind === "unavailable"
      ? [t("integrations.status.pending"), "bg-hf-tan-dark text-hf-black"]
      : integration.status === "CONNECTED"
        ? [t("integrations.status.connected"), "bg-hf-green text-hf-white"]
        : integration.status === "ERROR"
          ? [t("integrations.status.error"), "bg-hf-red-dark text-hf-white"]
          : integration.kind === "companion"
            ? [t("integrations.status.needsApp"), "bg-hf-tan-dark text-hf-black"]
            : [t("integrations.status.disconnected"), "bg-hf-tan-dark text-hf-black"];
  return <span className={`hf-type-micro hf-type-strong shrink-0 rounded-full px-2.5 py-1 ${style}`}>{label}</span>;
}
