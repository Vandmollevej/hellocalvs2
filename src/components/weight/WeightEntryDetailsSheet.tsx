"use client";

import { useEffect, useState } from "react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { AttireToggles } from "@/components/weight/AttireToggles";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatBodyMetric, orderBodyMetrics } from "@/lib/body-metrics";
import { formatWeight, useUnits } from "@/lib/units";
import type { WeighAttire } from "@/lib/weigh-attire";

// Info-vindue for én vejning (2026-10-07, brugerkrav: man skal altid kunne
// klikke ind på vejningen fra Seneste vejninger og kalenderen). Viser kilde,
// tøj (kan ændres) og — under tøjet — fedtprocent m.m. fra smartvægten.

type Detail = {
  entry: { id: string; weightKg: number; weighedAt: string; source: string; attire: WeighAttire | null };
  source: { label: string; icon: string | null } | null;
  metrics: { type: string; value: number }[];
};

export function WeightEntryDetailsSheet({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const { t, locale } = useTranslation();
  const { weight: weightUnit } = useUnits();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [attire, setAttire] = useState<WeighAttire | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/weight-entries/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as Detail;
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setAttire(data.entry.attire);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    if (!attire) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/weight-entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attire }),
      });
      if (response.ok) onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  const at = detail ? new Date(detail.entry.weighedAt) : null;
  const changed = detail ? attire !== detail.entry.attire && attire !== null : false;
  const metrics = detail ? orderBodyMetrics(detail.metrics) : [];

  return (
    <BottomSheet
      title={detail ? formatWeight(detail.entry.weightKg, weightUnit) : t("weighIn.details.title")}
      onClose={onClose}
      footer={
        <>
          {changed && (
            <BottomSheetCloseButton onClick={() => void save()} className="hf-btn-primary h-12 w-full px-4">
              {saving ? t("weighIn.saving") : t("weighIn.save")}
            </BottomSheetCloseButton>
          )}
          <BottomSheetCloseButton className={changed ? "hf-bottom-sheet__skip" : "hf-btn-primary h-12 w-full px-4"}>
            {t("common.close")}
          </BottomSheetCloseButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-4">
        {at && (
          <p className="hf-type-body text-center text-text-secondary">
            {new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(at)}
          </p>
        )}
        {failed && (
          <p role="alert" className="hf-type-body text-center text-hf-red-dark">
            {t("weighIn.details.failed")}
          </p>
        )}
        {!detail && !failed && (
          <p role="status" className="hf-type-small text-center text-text-secondary">
            {t("entrySheet.loading")}
          </p>
        )}
        {detail?.source && (
          <div className="flex items-center gap-3 bg-hf-tan px-4 py-3 rounded-card">
            <IntegrationIcon icon={detail.source.icon} label={detail.source.label} size={32} className="rounded-card" />
            <p className="hf-type-body hf-type-strong text-hf-black">{t("entrySheet.syncedFrom", { name: detail.source.label })}</p>
          </div>
        )}
        {detail && !detail.source && (
          <p className="hf-type-body hf-type-strong text-center text-hf-black">{t("entrySheet.manual")}</p>
        )}

        {detail && (
          <>
            <p className="hf-type-body hf-type-strong text-hf-black">{t("weighIn.attireTitle")}</p>
            <AttireToggles value={attire} onChange={setAttire} />
          </>
        )}

        {metrics.length > 0 && (
          <dl className="overflow-hidden bg-hf-tan rounded-card">
            {metrics.map((metric, index) => (
              <div
                key={metric.type}
                className={`flex min-h-12 items-center justify-between gap-4 px-4 ${index < metrics.length - 1 ? "border-b border-hf-tan-dark" : ""}`}
              >
                <dt className="hf-type-body text-hf-black">{t(`entrySheet.metrics.${metric.type}`)}</dt>
                <dd className="hf-type-body hf-type-strong text-right text-hf-black">
                  {formatBodyMetric(
                    metric.value,
                    metric.display,
                    metric.display.unit === "years" ? t("entrySheet.years") : metric.display.unit,
                    intlLocale(locale)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </BottomSheet>
  );
}
