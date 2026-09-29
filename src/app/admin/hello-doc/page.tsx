import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { DOCTOR_SHARE_HISTORY_RANGES, isDoctorShareHistoryRange, type DoctorShareHistoryRange } from "@/lib/doctor-share";
import { fetchDoctorShareOwnerData } from "@/lib/doctor-share-data";
import { MiniBarChart, MiniLineChart } from "@/components/hf/MiniChart";

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

const dateFormat = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" });

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

  const weightPoints = data.weightHistory.map((e) => ({ label: dateFormat.format(new Date(e.date)), value: e.weightKg }));
  const kcalPoints = data.dailyNutrition.map((d) => ({ label: d.dateKey, value: Math.round(d.kcal) }));
  const fluidPoints = data.fluidHistory.map((e) => ({ label: dateFormat.format(new Date(e.date)), value: e.valueMl }));
  const totals = data.dailyNutrition.reduce(
    (acc, d) => ({
      vitaminA: acc.vitaminA + d.vitaminA,
      vitaminC: acc.vitaminC + d.vitaminC,
      calcium: acc.calcium + d.calcium,
      iron: acc.iron + d.iron,
      potassium: acc.potassium + d.potassium,
    }),
    { vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0, potassium: 0 }
  );
  const vitaminPoints = [
    { label: "Vitamin A", value: Math.round(totals.vitaminA) },
    { label: "Vitamin C", value: Math.round(totals.vitaminC) },
    { label: "Calcium", value: Math.round(totals.calcium) },
    { label: "Jern", value: Math.round(totals.iron) },
    { label: "Kalium", value: Math.round(totals.potassium) },
  ];
  const empty = "Ingen data i denne periode";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Hello Doc</h1>
        <p className="text-sm text-text-secondary">
          Sådan ser lægevisningen ud med din egen konto ({data.profile.email}) som udgangspunkt.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DOCTOR_SHARE_HISTORY_RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/hello-doc?range=${r}`}
            className={`rounded-full border border-border-strong px-3 py-1 text-sm ${
              r === range ? "bg-hf-tan text-text-primary" : "text-text-secondary"
            }`}
          >
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="text-xs text-text-secondary">Navn</p>
          <p className="text-lg font-semibold text-text-primary">{data.profile.displayName}</p>
        </div>
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="text-xs text-text-secondary">Startvægt</p>
          <p className="text-lg font-semibold text-text-primary">
            {data.startWeightKg != null ? `${data.startWeightKg} kg` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="text-xs text-text-secondary">Målvægt</p>
          <p className="text-lg font-semibold text-text-primary">
            {data.targetWeightKg != null ? `${data.targetWeightKg} kg` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="text-xs text-text-secondary">Søvn (normal)</p>
          <p className="text-lg font-semibold text-text-primary">
            {data.sleep.defaultBedtime ?? "—"} – {data.sleep.defaultWakeTime ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border-strong bg-surface-1 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Vægt</h2>
          <MiniLineChart points={weightPoints} unit=" kg" emptyLabel={empty} />
        </section>
        <section className="rounded-lg border border-border-strong bg-surface-1 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Kalorier pr. dag</h2>
          <MiniBarChart points={kcalPoints} emptyLabel={empty} />
        </section>
        <section className="rounded-lg border border-border-strong bg-surface-1 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Vitaminer og mineraler (sum)</h2>
          <MiniBarChart points={vitaminPoints} color="var(--hf-color-appbar)" emptyLabel={empty} />
        </section>
        <section className="rounded-lg border border-border-strong bg-surface-1 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Væske</h2>
          <MiniBarChart points={fluidPoints} color="var(--hf-color-google)" emptyLabel={empty} />
        </section>
      </div>
    </div>
  );
}
