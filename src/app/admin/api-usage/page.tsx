import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getApiUsageOverview } from "@/lib/api-usage";
import { loadAlertSettings } from "@/lib/api-alerts";
import { ApiUsageDashboard } from "@/components/admin/ApiUsageDashboard";
import { OpenAiUsagePanel } from "@/components/admin/OpenAiUsagePanel";
import { ApiAlertSettingsPanel } from "@/components/admin/ApiAlertSettingsPanel";

export const dynamic = "force-dynamic";

// Admin "API-forbrug" (docs/DECISIONS.md 2026-10-16): status, forbrug og
// budget for hver betalt tjeneste, OpenAI i detaljer og varsler på mail.
export default async function ApiUsagePage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const [overview, alerts] = await Promise.all([getApiUsageOverview(), loadAlertSettings()]);

  return (
    <div className="hf-admin-page">
      <div>
        <h1 className="hf-type-title text-hf-black">API-forbrug</h1>
        <p className="hf-type-body mt-1 text-text-secondary">
          Status, månedens forbrug og budget for de tjenester, der koster penge.
        </p>
      </div>
      <ApiUsageDashboard initial={overview} />
      <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">OpenAI i detaljer</h2>
      <OpenAiUsagePanel initial={overview.openai} />
      <ApiAlertSettingsPanel initial={alerts} />
    </div>
  );
}
