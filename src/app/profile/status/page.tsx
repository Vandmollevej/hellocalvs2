"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { DropdownSection } from "@/components/hf/DropdownSection";
import { HistoryLineChart } from "@/components/HistoryLineChart";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { BODY_MEASUREMENT_FIELDS } from "@/lib/body-measurements";
import type { BodyMeasurementSeriesEntry } from "@/lib/body-measurement-series";
import {
  buildMeasurementHistory,
  buildWeightHistory,
  currentWeightKg,
  latestBodyGoals,
  remainingToGoalKg,
  type HistoryPoint,
  type StatusGoal,
  type StatusWeightEntry,
} from "@/lib/profile-status";
import { formatLength, formatWeight, useUnits } from "@/lib/units";

type StatusData = {
  startWeightKg: number | null;
  targetWeightKg: number | null;
  weights: StatusWeightEntry[];
  measurements: BodyMeasurementSeriesEntry[];
  goals: StatusGoal[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} svarede ${response.status}`);
  return (await response.json()) as T;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Fold-ud-rækkens seneste måling: "d. 3. okt. 82,4 kg" (årstal kun, hvis det
// ikke er i år).
function formatLatestDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}

function StatusTile({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex flex-1 flex-col gap-1 rounded-2xl bg-hf-tan p-4 text-hf-black">
      <span className="hf-type-small text-text-secondary">{label}</span>
      <span className="hf-type-title">{value}</span>
    </Link>
  );
}

// Uden målvægt står "Sæt et mål" midt i feltet i stedet for en overskrift.
function SetGoalTile({ label }: { label: string }) {
  return (
    <Link
      href="/profile/goals"
      className="hf-type-body hf-type-strong flex flex-1 items-center justify-center rounded-2xl bg-hf-tan p-4 text-center text-hf-black underline"
    >
      {label}
    </Link>
  );
}

// Antal målinger under grafen, før "Vis alle" — grafen viser altid alle.
const HISTORY_ROWS = 10;

// Graf øverst, derefter målingerne nyeste først.
function HistoryPanel({
  points,
  format,
  target,
  targetLabel,
  ariaLabel,
  emptyText,
}: {
  points: HistoryPoint[];
  format: (value: number) => string;
  target?: number | null;
  targetLabel?: string;
  ariaLabel: string;
  emptyText: string;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  if (points.length === 0) {
    return <p className="hf-type-small text-text-secondary text-center">{emptyText}</p>;
  }
  const newestFirst = [...points].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, HISTORY_ROWS);
  return (
    <div className="flex flex-col gap-4">
      <HistoryLineChart points={points} format={format} target={target} targetLabel={targetLabel} ariaLabel={ariaLabel} />
      <div className="flex flex-col divide-y divide-hf-tan-dark border-t border-hf-tan-dark">
        {visible.map((point, index) => (
          <div key={point.id ?? `${point.at}-${index}`} className="hf-control-row flex items-center justify-between gap-3">
            <span className="hf-type-small text-text-secondary">{formatDateTime(point.at)}</span>
            <span className="hf-type-body hf-type-strong text-hf-black">{format(point.value)}</span>
          </div>
        ))}
      </div>
      {newestFirst.length > HISTORY_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="hf-type-small hf-type-strong text-hf-black underline text-center"
        >
          {showAll ? t("profileStatus.showLess") : t("profileStatus.showAll", { count: newestFirst.length })}
        </button>
      )}
    </div>
  );
}

export default function ProfileStatusPage() {
  const { t } = useTranslation();
  const { weight: weightUnit, height: lengthUnit } = useUnits();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ user: { weightKg: number | null; targetWeightKg: number | null } }>("/api/profile"),
      fetchJson<{ entries: StatusWeightEntry[] }>("/api/weight-entries"),
      fetchJson<{ entries: BodyMeasurementSeriesEntry[] }>("/api/body-measurements"),
      // Kropsmålenes mål er ekstra — siden virker også uden dem.
      fetchJson<{ goals: StatusGoal[] }>("/api/goals").catch(() => ({ goals: [] })),
    ])
      .then(([profile, weights, measurements, goals]) => {
        if (cancelled) return;
        setData({
          startWeightKg: profile.user.weightKg ?? null,
          targetWeightKg: profile.user.targetWeightKg ?? null,
          weights: weights.entries,
          measurements: measurements.entries,
          goals: goals.goals,
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <HfScreen title={t("profileStatus.title")}>
        {loading ? (
          <SkeletonScreen>
            <SkeletonCards count={1} height={88} radius={16} />
            <SkeletonCards count={6} height={48} radius={16} />
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-4 text-center">{t("profileStatus.loadError")}</p>
        )}
      </HfScreen>
    );
  }

  const weightHistory = buildWeightHistory(data.weights);
  const current = currentWeightKg(weightHistory, data.startWeightKg);
  const target = data.targetWeightKg != null && data.targetWeightKg > 0 ? data.targetWeightKg : null;
  const remaining = remainingToGoalKg(current, target);
  const showWeight = (kg: number) => formatWeight(kg, weightUnit);
  const showLength = (cm: number) => formatLength(cm, lengthUnit);
  const bodyGoals = latestBodyGoals(
    data.goals,
    BODY_MEASUREMENT_FIELDS.map(({ field }) => field),
  );
  const bodyGoalFields = BODY_MEASUREMENT_FIELDS.filter(({ field }) => bodyGoals[field] != null);
  const measurementHistories = BODY_MEASUREMENT_FIELDS.map((entry) => ({
    ...entry,
    points: buildMeasurementHistory(data.measurements, entry.field),
  }));
  const latestDetail = (points: HistoryPoint[], format: (value: number) => string) => {
    const latest = points[points.length - 1];
    return latest
      ? t("profileStatus.latest", { date: formatLatestDate(latest.at), value: format(latest.value) })
      : undefined;
  };

  return (
    <HfScreen title={t("profileStatus.title")}>
      <div className="hf-page">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <StatusTile
              label={t("profileStatus.currentWeight")}
              value={current != null ? showWeight(current) : "—"}
              href="/weight/create"
            />
            {target != null ? (
              <StatusTile label={t("profileStatus.goal")} value={showWeight(target)} href="/profile/goals" />
            ) : (
              <SetGoalTile label={t("profileStatus.setGoal")} />
            )}
          </div>
          {remaining != null && (
            <p className="hf-type-small text-text-secondary text-center">
              {remaining === 0
                ? t("profileStatus.goalReached")
                : t(remaining > 0 ? "profileStatus.toLose" : "profileStatus.toGain", {
                    value: showWeight(Math.abs(remaining)),
                  })}
            </p>
          )}
        </div>

        {bodyGoalFields.length > 0 && (
          <>
            <p className="hf-type-section-title">{t("profileStatus.bodyGoals")}</p>
            <div className="grid grid-cols-2 gap-2">
              {bodyGoalFields.map(({ field, nameKey }) => (
                <StatusTile key={field} label={t(nameKey)} value={showLength(bodyGoals[field]!)} href="/profile/goals" />
              ))}
            </div>
          </>
        )}

        <p className="hf-type-section-title">{t("profileStatus.history")}</p>
        <div className="flex flex-col gap-2">
          <DropdownSection title={t("profileStatus.weightHistory")} detail={latestDetail(weightHistory, showWeight)}>
            <HistoryPanel
              points={weightHistory}
              format={showWeight}
              target={target}
              targetLabel={target != null ? t("profileStatus.goal") : undefined}
              ariaLabel={t("profileStatus.chartAria", { name: t("profileStatus.weightHistory") })}
              emptyText={t("profileStatus.noWeights")}
            />
          </DropdownSection>
          {measurementHistories.map(({ field, nameKey, points }) => (
            <DropdownSection key={field} title={t(nameKey)} detail={latestDetail(points, showLength)}>
              <HistoryPanel
                points={points}
                format={showLength}
                target={bodyGoals[field] ?? null}
                targetLabel={bodyGoals[field] != null ? t("profileStatus.measurementGoal") : undefined}
                ariaLabel={t("profileStatus.chartAria", { name: t(nameKey) })}
                emptyText={t("profileStatus.noMeasurements")}
              />
            </DropdownSection>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}
