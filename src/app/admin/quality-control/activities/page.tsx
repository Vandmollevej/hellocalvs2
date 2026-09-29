import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { QualityControlTabs } from "@/components/admin/QualityControlTabs";
import { ActivityTypeTable } from "@/components/admin/ActivityTypeTable";
import { loadActivityTypeRows } from "@/lib/admin-activities";

// Kvalitetskontrol → Aktiviteter (docs/DECISIONS.md 2026-09-29): nye
// brugertilføjede aktiviteter venter her på godkendelse.
export default async function AdminQualityControlActivitiesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const rows = await loadActivityTypeRows({ status: "PENDING" });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">{t(admin.locale, "quality_control_title")}</h1>
      <QualityControlTabs active="activities" locale={admin.locale} />
      <p className="hf-type-small text-text-secondary">{t(admin.locale, "activities_hint")}</p>
      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">{t(admin.locale, "quality_control_empty")}</p>
      ) : (
        <ActivityTypeTable rows={rows} locale={admin.locale} />
      )}
    </div>
  );
}
