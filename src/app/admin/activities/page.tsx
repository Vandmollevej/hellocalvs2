import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import { ActivityTypeTable } from "@/components/admin/ActivityTypeTable";
import { loadActivityTypeRows } from "@/lib/admin-activities";

// Alle aktiviteter: indbyggede + brugertilføjede i alle statusser.
export default async function AdminActivitiesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const rows = await loadActivityTypeRows({ includeBuiltIn: true });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">{t(admin.locale, "activities_title")}</h1>
      <p className="hf-type-small text-text-secondary">{t(admin.locale, "activities_hint")}</p>
      <ActivityTypeTable rows={rows} locale={admin.locale} />
    </div>
  );
}
