"use client";

import { useEffect, useMemo, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { HistoryLineChart } from "@/components/HistoryLineChart";
import { useTranslation } from "@/i18n/LocaleProvider";
import { CARDIO_METRICS, CARDIO_RANGES, dailyValues, type CardioMetric } from "@/lib/cardio";

type Row = { type: string; value: number; recordedAt: string };

function fmt(value: number, m: CardioMetric) {
  return value.toFixed(m.decimals).replace(".", ",");
}

export default function CardioPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<string>("90");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});

  function load(r = range) {
    const days = CARDIO_RANGES.find((x) => x.key === r)?.days ?? 0;
    fetch(`/api/cardio?days=${days}`)
      .then((res) => res.json())
      .then((data: { metrics?: Row[] }) => setRows(data.metrics ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const series = useMemo(
    () =>
      CARDIO_METRICS.map((m) => ({
        m,
        points: dailyValues(rows.filter((r) => r.type === m.type), m.agg),
      })),
    [rows],
  );

  async function commit(m: CardioMetric) {
    const raw = (draft[m.type] ?? "").trim().replace(",", ".");
    if (!raw) return;
    const res = await fetch("/api/cardio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: m.type, value: Number(raw) }),
    });
    if (res.ok) {
      setDraft((d) => ({ ...d, [m.type]: "" }));
      load();
    }
  }

  return (
    <HfScreen title={t("cardio.title")}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("cardio.intro")}</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          aria-label={t("cardio.range")}
          className="hf-type-body hf-field hf-field-soft"
        >
          {CARDIO_RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {t(`cardio.ranges.${r.key}`)}
            </option>
          ))}
        </select>
        {loading && <p className="hf-type-caption text-center">…</p>}
        {series.map(({ m, points }) => {
          const last = points[points.length - 1];
          return (
            <div key={m.type} className="hf-card flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="hf-type-body hf-type-strong text-hf-black">{t(`cardio.${m.key}`)}</span>
                <span className="hf-type-body text-hf-black">
                  {last ? `${fmt(last.value, m)} ${m.unit}` : "–"}
                </span>
              </div>
              <HistoryLineChart
                points={points}
                format={(v) => fmt(v, m)}
                ariaLabel={t(`cardio.${m.key}`)}
              />
              <div className="flex items-baseline justify-end gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft[m.type] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [m.type]: e.target.value }))}
                  onBlur={() => commit(m)}
                  placeholder={t("cardio.placeholder")}
                  className="hf-type-title w-24 min-w-0 border-b border-transparent bg-transparent px-0 py-0.5 text-right text-hf-black outline-none placeholder:text-hf-black/30 focus:border-hf-black/30"
                />
                <span className="hf-type-body text-text-secondary shrink-0">{m.unit}</span>
              </div>
            </div>
          );
        })}
        {!loading && rows.length === 0 && (
          <p className="hf-type-caption text-center">{t("cardio.empty")}</p>
        )}
      </div>
    </HfScreen>
  );
}
