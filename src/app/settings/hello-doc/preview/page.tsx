"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconChevronLeft, IconChevronDown, IconLock } from "@tabler/icons-react";
import { HelloDocInsight, type InsightData } from "@/components/hf/HelloDocInsight";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DOCTOR_SHARE_HISTORY_RANGES,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";
import { InsightMenu } from "@/components/hf/InsightMenu";
import { useInsightLayout } from "@/lib/insight-layout";
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
  const { layout, toggle, move } = useInsightLayout();

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
      <div className="hf-shell__topbar static h-14 justify-between px-2 lg:px-2">
        <button type="button" onClick={() => router.back()} aria-label={t("common.back")} className="hf-btn-icon text-hf-black">
          <IconChevronLeft size={22} stroke={2.5} />
        </button>
        <span className="hf-type-title">Hello Doc</span>
        <InsightMenu layout={layout} onToggle={toggle} onMove={move}>
          <button type="button" className="hf-navrow hf-control-row">
            {t("helloDoc.preview.menuHelp")}
          </button>
          <Link href="/profile/edit" className="hf-navrow hf-control-row">
            {t("helloDoc.preview.menuMyDetails")}
          </Link>
          <button type="button" onClick={logOut} className="hf-navrow hf-control-row text-hf-red-dark">
            {t("helloDoc.preview.menuLogout")}
          </button>
        </InsightMenu>
      </div>

      <div
        className="hf-type-caption flex flex-shrink-0 items-center gap-2 border-b bg-hf-cream px-4 py-2 text-text-secondary border-hf-line"
      >
        <IconLock size={14} stroke={2.5} />
        <span className="truncate">
          {t("helloDoc.previewAddress")}
          ••••••••••••
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {error && <p className="hf-type-body p-4 text-hf-red-dark">{t("helloDoc.loadError")}</p>}

        {!error && !data && (
          <SkeletonScreen className="hf-page hf-page--sections">
            <div className="hf-card items-center">
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
                className="hf-field hf-type-input w-full appearance-none border bg-hf-cream pl-3 pr-9 outline-none border-hf-field-border rounded-card"
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
            <HelloDocInsight data={insight} layout={layout} />
          </div>
        )}
      </div>
    </div>
  );
}
