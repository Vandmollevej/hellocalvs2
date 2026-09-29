"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconChevronLeft, IconMenu2, IconChevronDown } from "@tabler/icons-react";
import { HelloDocInsight, type InsightData } from "@/components/hf/HelloDocInsight";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DOCTOR_SHARE_HISTORY_RANGES,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";
import { Skeleton, SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";

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

// "Sådan ser det ud" (docs/DECISIONS.md 2026-09-12): the scientific/medical-
// styled page a shared Hello Doc recipient would eventually see. There is no
// token-authenticated external access yet, so this renders the SIGNED-IN
// owner's own data as a preview of the format — see the API route's own
// comment and docs/STATUS.md "Next work" for the real external view.
export default function HelloDocPreviewPage() {
  const { t } = useTranslation();
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

  const insight: InsightData | null = data && {
    profile: data.profile,
    weight: { startWeightKg: data.startWeightKg, startWeightRecordedAt: data.startWeightRecordedAt, history: data.weightHistory },
    goals: { targetWeightKg: data.targetWeightKg },
    sleep: data.sleep,
    dailyNutrition: data.dailyNutrition,
    fluidHistory: data.fluidHistory,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-hf-white">
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b px-2" style={{ borderColor: "var(--hf-color-line)" }}>
        <button type="button" onClick={() => router.back()} aria-label={t("common.back")} className="hf-btn-icon text-hf-black">
          <IconChevronLeft size={22} stroke={2.5} />
        </button>
        <span className="hf-type-category-title">Hello Doc</span>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("helloDoc.preview.menuView")}
            className="hf-btn-icon text-hf-black"
          >
            <IconMenu2 size={22} stroke={2} />
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border bg-hf-white p-1 shadow-xl" style={{ borderColor: "var(--hf-color-line)" }}>
                <button type="button" className="hf-control-row hf-type-body w-full rounded-lg px-3 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuHelp")}
                </button>
                <button type="button" className="hf-control-row hf-type-body w-full rounded-lg px-3 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuView")}
                </button>
                <Link href="/profile/edit" className="hf-control-row hf-type-body flex w-full items-center rounded-lg px-3 text-left hover:bg-hf-cream">
                  {t("helloDoc.preview.menuMyDetails")}
                </Link>
                <button type="button" onClick={logOut} className="hf-control-row hf-type-body w-full rounded-lg px-3 text-left text-hf-red-dark hover:bg-hf-cream">
                  {t("helloDoc.preview.menuLogout")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="text-text-secondary hf-type-caption mx-4 mt-4 rounded-lg p-4" style={{ background: "var(--hf-color-card)" }}>
          {t("helloDoc.preview.disclaimer")}
        </p>

        {error && <p className="hf-type-body p-4 text-hf-red-dark">{t("helloDoc.loadError")}</p>}

        {!error && !data && (
          <SkeletonScreen className="hf-page hf-page--sections">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-hf-tan p-4">
              <Skeleton type="circle" height={96} />
              <Skeleton type="card-title" width="50%" />
              <Skeleton type="caption" width="40%" />
            </div>
            <SkeletonCards count={3} height={140} gap={16} />
          </SkeletonScreen>
        )}

        {insight && (
          <div className="hf-page hf-page--sections">
            <div className="relative ml-auto w-48">
              <select
                className="hf-field hf-type-input w-full appearance-none rounded-[8px] border bg-hf-cream pl-3 pr-9 outline-none"
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
            <HelloDocInsight data={insight} />
          </div>
        )}
      </div>
    </div>
  );
}
