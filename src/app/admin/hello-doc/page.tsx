import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { DOCTOR_SHARE_HISTORY_RANGES, isDoctorShareHistoryRange, type DoctorShareHistoryRange } from "@/lib/doctor-share";
import { fetchDoctorShareOwnerData } from "@/lib/doctor-share-data";
import { InsightGrid, InsightKpi, type InsightData } from "@/components/hf/HelloDocInsight";

// Admin "Hello Doc": lægevisningen med administratorens EGEN konto som
// datagrundlag, så dashboardets opbygning kan vurderes. Viser alle
// kategorier (ejeren ser sine egne data), som /settings/hello-doc/preview.

export const dynamic = "force-dynamic";

const RANGE_LABEL: Record<DoctorShareHistoryRange, string> = {
  LAST_7_DAYS: "Sidste 7 dage",
  LAST_MONTH: "Sidste måned",
  LAST_YEAR: "Sidste år",
  ALL: "Alt",
};

export default async function AdminHelloDocPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const range = isDoctorShareHistoryRange(params.range) ? params.range : "ALL";
  const data = await fetchDoctorShareOwnerData(admin.id, range);
  if (!data) redirect("/admin/login");

  const insight: InsightData = {
    weight: { startWeightKg: data.startWeightKg, startWeightRecordedAt: data.startWeightRecordedAt, history: data.weightHistory },
    dailyNutrition: data.dailyNutrition,
    fluidHistory: data.fluidHistory,
  };

  return (
    <div className="hf-insight__content">
      <div className="hf-insight__head">
        <h1 className="hf-type-page-title">Hello Doc</h1>
        <p className="hf-type-body text-text-secondary">
          Sådan ser lægevisningen ud med din egen konto ({data.profile.email}) som udgangspunkt.
        </p>
      </div>

      <div className="hf-insight__toolbar">
        {DOCTOR_SHARE_HISTORY_RANGES.map((r) => (
          <Link key={r} href={`/admin/hello-doc?range=${r}`} className={`hf-choice ${r === range ? "is-selected" : ""}`}>
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </div>

      <div className="hf-insight__kpis">
        <InsightKpi label="Navn" value={data.profile.displayName} />
        <InsightKpi label="Startvægt" value={data.startWeightKg != null ? `${data.startWeightKg} kg` : "—"} />
        <InsightKpi label="Målvægt" value={data.targetWeightKg != null ? `${data.targetWeightKg} kg` : "—"} />
        <InsightKpi label="Søvn (normal)" value={`${data.sleep.defaultBedtime ?? "—"} – ${data.sleep.defaultWakeTime ?? "—"}`} />
      </div>

      <InsightGrid data={insight} />
    </div>
  );
}
