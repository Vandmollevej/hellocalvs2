"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconChevronLeft, IconMenu2, IconChevronDown } from "@tabler/icons-react";
import { MiniLineChart, MiniBarChart, type MiniChartPoint } from "@/components/hf/MiniChart";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DOCTOR_SHARE_HISTORY_RANGES,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";

type PreviewData = {
  profile: { displayName: string; email: string; sex: "MALE" | "FEMALE" | null };
  startWeightKg: number | null;
  startWeightRecordedAt: string;
  targetWeightKg: number | null;
  sleep: { defaultBedtime: string | null; defaultWakeTime: string | null };
  weightHistory: { date: string; weightKg: number }[];
  fluidHistory: { date: string; valueMl: number }[];
  dailyNutrition: {
    dateKey: string;
    kcal: number;
    vitaminA: number;
    vitaminC: number;
    calcium: number;
    iron: number;
    potassium: number;
  }[];
};

const HISTORY_LABEL_KEY: Record<DoctorShareHistoryRange, string> = {
  LAST_7_DAYS: "helloDoc.historyLast7Days",
  LAST_MONTH: "helloDoc.historyLastMonth",
  LAST_YEAR: "helloDoc.historyLastYear",
  ALL: "helloDoc.historyAll",
};

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// "Sådan ser det ud" (docs/DECISIONS.md 2026-09-12): the scientific/medical-
// styled page a shared Hello Doc recipient would eventually see. There is no
// token-authenticated external access yet, so this renders the SIGNED-IN
// owner's own data as a preview of the format — see the API route's own
// comment and docs/STATUS.md "Next work" for the real external view.
export default function HelloDocPreviewPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<DoctorShareHistoryRange>("ALL");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/doctor-shares/preview?range=${range}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const weightPoints: MiniChartPoint[] =
    data?.weightHistory.map((entry) => ({ label: formatDate(entry.date, locale), value: entry.weightKg })) ?? [];
  const kcalPoints: MiniChartPoint[] =
    data?.dailyNutrition.map((day) => ({ label: day.dateKey, value: Math.round(day.kcal) })) ?? [];
  const fluidPoints: MiniChartPoint[] =
    data?.fluidHistory.map((entry) => ({ label: formatDate(entry.date, locale), value: entry.valueMl })) ?? [];

  const vitaminTotals = data?.dailyNutrition.reduce(
    (acc, day) => ({
      vitaminA: acc.vitaminA + day.vitaminA,
      vitaminC: acc.vitaminC + day.vitaminC,
      calcium: acc.calcium + day.calcium,
      iron: acc.iron + day.iron,
      potassium: acc.potassium + day.potassium,
    }),
    { vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0, potassium: 0 }
  );
  const vitaminPoints: MiniChartPoint[] = vitaminTotals
    ? [
        { label: "Vitamin A", value: Math.round(vitaminTotals.vitaminA) },
        { label: "Vitamin C", value: Math.round(vitaminTotals.vitaminC) },
        { label: "Calcium", value: Math.round(vitaminTotals.calcium) },
        { label: "Jern", value: Math.round(vitaminTotals.iron) },
        { label: "Kalium", value: Math.round(vitaminTotals.potassium) },
      ]
    : [];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-white">
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b px-2" style={{ borderColor: "var(--hf-color-line)" }}>
        <button type="button" onClick={() => router.back()} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center text-hf-black">
          <IconChevronLeft size={22} stroke={2.5} />
        </button>
        <span className="hf-type-section-title">Hello Doc</span>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("helloDoc.preview.menuView")}
            className="flex h-11 w-11 items-center justify-center text-hf-black"
          >
            <IconMenu2 size={22} stroke={2} />
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border bg-hf-white p-1 shadow-xl" style={{ borderColor: "var(--hf-color-line)" }}>
                <button type="button" className="hf-type-body-sm w-full rounded-lg px-3 py-2.5 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuHelp")}
                </button>
                <button type="button" className="hf-type-body-sm w-full rounded-lg px-3 py-2.5 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuView")}
                </button>
                <Link href="/profile/edit" className="hf-type-body-sm block w-full rounded-lg px-3 py-2.5 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuMyDetails")}
                </Link>
                <button type="button" onClick={logOut} className="hf-type-body-sm w-full rounded-lg px-3 py-2.5 text-left text-hf-red-dark hover:bg-hf-cream">
                  {t("helloDoc.preview.menuLogout")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="hf-type-caption mx-4 mt-3 rounded-lg p-3 opacity-80" style={{ background: "var(--hf-color-card)" }}>
          {t("helloDoc.preview.disclaimer")}
        </p>

        {error && <p className="hf-type-body-sm p-4 text-hf-red-dark">{t("helloDoc.loadError")}</p>}

        {!error && !data && <p className="hf-type-body-sm p-4 opacity-70">{t("common.loading")}</p>}

        {data && (
          <div className="flex flex-col gap-6 p-4 md:flex-row md:items-start">
            <aside className="flex flex-col gap-4 rounded-xl p-4 md:w-64 md:shrink-0" style={{ background: "var(--hf-color-card)" }}>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-hf-tan-dark text-2xl font-bold text-hf-black">
                  {initials(data.profile.displayName)}
                </span>
                <p className="hf-type-section-title">{data.profile.displayName}</p>
                <p className="hf-type-caption opacity-70">{data.profile.email}</p>
              </div>

              <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--hf-color-line)" }}>
                <div>
                  <p className="hf-type-caption opacity-70">{t("helloDoc.preview.startWeight")}</p>
                  <p className="hf-type-body font-bold">{data.startWeightKg != null ? `${data.startWeightKg} kg` : "—"}</p>
                  <p className="hf-type-caption opacity-60">
                    {t("helloDoc.preview.recordedOn", { date: formatDate(data.startWeightRecordedAt, locale) })}
                  </p>
                </div>
                <div>
                  <p className="hf-type-caption opacity-70">{t("helloDoc.preview.startGoal")}</p>
                  <p className="hf-type-body font-bold">{data.targetWeightKg != null ? `${data.targetWeightKg} kg` : "—"}</p>
                  {data.targetWeightKg != null && (
                    <p className="hf-type-caption opacity-60">
                      {t("helloDoc.preview.recordedOn", { date: formatDate(data.startWeightRecordedAt, locale) })}
                    </p>
                  )}
                </div>
                <div>
                  <p className="hf-type-caption opacity-70">{t("helloDoc.preview.sleepSection")}</p>
                  <p className="hf-type-body">
                    {t("helloDoc.preview.sleepBedtime")}: {data.sleep.defaultBedtime ?? t("helloDoc.preview.sleepNotSet")}
                  </p>
                  <p className="hf-type-body">
                    {t("helloDoc.preview.sleepWakeTime")}: {data.sleep.defaultWakeTime ?? t("helloDoc.preview.sleepNotSet")}
                  </p>
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <div className="relative mb-4 ml-auto w-48">
                <select
                  className="hf-type-input h-10 w-full appearance-none rounded-[8px] border bg-hf-cream pl-3 pr-9 text-[14px] outline-none"
                  style={{ borderColor: "var(--hf-color-field-border)" }}
                  value={range}
                  onChange={(event) => setRange(event.target.value as DoctorShareHistoryRange)}
                >
                  {DOCTOR_SHARE_HISTORY_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {t(HISTORY_LABEL_KEY[r])}
                    </option>
                  ))}
                </select>
                <IconChevronDown size={16} stroke={2.5} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hf-black" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
                  <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.weightSection")}</h3>
                  <MiniLineChart points={weightPoints} unit=" kg" emptyLabel={t("helloDoc.preview.noChartData")} />
                </section>

                <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
                  <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.foodSection")}</h3>
                  <MiniBarChart points={kcalPoints} emptyLabel={t("helloDoc.preview.noChartData")} />
                  <p className="hf-type-caption mt-1 text-right opacity-60">{t("helloDoc.preview.kcalUnit")}/dag</p>
                </section>

                <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
                  <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.vitaminsSection")}</h3>
                  <MiniBarChart points={vitaminPoints} color="var(--hf-color-appbar)" emptyLabel={t("helloDoc.preview.noChartData")} />
                </section>

                <section className="rounded-xl border p-4" style={{ borderColor: "var(--hf-color-line)" }}>
                  <h3 className="hf-type-section-title mb-2">{t("helloDoc.preview.fluidSection")}</h3>
                  <MiniBarChart points={fluidPoints} color="var(--hf-color-google)" emptyLabel={t("helloDoc.preview.noChartData")} />
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
