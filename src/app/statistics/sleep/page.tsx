"use client";

// Søvnstatistik (docs/DECISIONS.md 2026-09-29): åbnes fra "Statistik" i
// kalenderens søvnbjælke. Periodevalg øverst; graferne findes også som
// tilvalg i statistikmodulet (src/lib/stat-charts.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { IconChevronRight } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TrendIcon } from "@/components/BottomNav";
import { SleepInsightChart } from "@/components/SleepInsightChart";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fetchSleepQuality, localDateKey } from "@/lib/sleep-quality";
import { StatPeriodSelect } from "@/components/hf/StatPeriodSelect";
import { buildSleepStatDays, sleepPeriodDays, type SleepStatPeriodKey } from "@/lib/sleep-stats";
import { useSleepStatInputs } from "@/lib/use-sleep-stat-inputs";

export default function SleepStatisticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<SleepStatPeriodKey>("last7");
  const periodDays = useMemo(() => sleepPeriodDays(period), [period]);
  const inputs = useSleepStatInputs();
  const [ratings, setRatings] = useState<{ date: string; rating: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchSleepQuality(localDateKey(periodDays[0]), localDateKey(periodDays[periodDays.length - 1]))
      .then((entries) => {
        if (!cancelled) setRatings(entries);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const days = useMemo(
    () => buildSleepStatDays({ days: periodDays, ratings, ...inputs }),
    [periodDays, ratings, inputs],
  );
  const connected = inputs.integrations.filter((i) => i.status === "CONNECTED");
  const available = inputs.integrations.filter((i) => i.kind !== "unavailable" && !i.legacy && i.status !== "CONNECTED");

  return (
    <HfScreen title={t("sleepStats.title")} icon={<TrendIcon color="currentColor" size={20} />}>
      <div className="hf-page">
        <StatPeriodSelect value={period} onChange={setPeriod} />

        {inputs.loading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-hf-tan" />
        ) : (
          <>
            <SleepInsightChart kind="quality" days={days} />
            <SleepInsightChart kind="kcal" days={days} />
            <SleepInsightChart kind="coffee" days={days} />
            <SleepInsightChart kind="sport" days={days} />
            {connected.length > 0 && <SleepInsightChart kind="device" days={days} />}
            <SleepInsightChart kind="bodyFat" days={days} />
          </>
        )}

        {!inputs.loading && connected.length === 0 && available.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="hf-type-body-lg hf-heading text-hf-black">{t("sleepStats.devicesHeading")}</h2>
            <p className="hf-type-small text-text-secondary">{t("sleepStats.devicesIntro")}</p>
            <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-white">
              {available.map((integration) => (
                <Link
                  key={integration.provider}
                  href={`/settings/integrations/${integration.pageSlug}`}
                  className="hf-control-row flex items-center gap-3 border-b border-hf-tan-dark px-4 py-3 text-hf-black last:border-b-0"
                >
                  <IntegrationIcon icon={integration.icon} label={integration.label} size={32} className="rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="hf-type-body hf-type-strong block">{integration.label}</span>
                    <span className="hf-type-small block text-text-secondary">{integration.description}</span>
                  </span>
                  <IconChevronRight size={18} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </HfScreen>
  );
}
