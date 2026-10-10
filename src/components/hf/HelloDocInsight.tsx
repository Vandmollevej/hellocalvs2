"use client";

import { MiniBarChart, MiniLineChart, type MiniChartPoint } from "@/components/hf/MiniChart";
import { useTranslation } from "@/i18n/LocaleProvider";
import { intlLocale, type Locale } from "@/i18n";
import { INSIGHT_PANELS, type InsightLayout, type InsightPanelId } from "@/lib/insight-layout";

// Fælles visning af Hello Doc-indsigten (profilkolonne + grafpaneler), bygget
// på .hf-insight-/.hf-panel-klasserne i globals.css (adminfladens design).
// Bruges af lægevisningen /hello-doc/[token], admins Hello Doc og ejerens
// "Sådan ser det ud". Et udeladt (undefined/null) felt skjuler sin sektion,
// så lægen kun ser de kategorier, ejeren har delt.

export type InsightData = {
  profile?: { displayName: string; email: string } | null;
  weight?: {
    startWeightKg: number | null;
    startWeightRecordedAt: string;
    history: { date: string; weightKg: number }[];
  } | null;
  goals?: { targetWeightKg: number | null } | null;
  sleep?: { defaultBedtime: string | null; defaultWakeTime: string | null } | null;
  dailyNutrition?:
    | { dateKey: string; kcal: number; vitaminA: number; vitaminC: number; calcium: number; iron: number; potassium: number }[]
    | null;
  fluidHistory?: { date: string; valueMl: number }[] | null;
  // Nærings-panelerne følger hver sin delekategori; standard er synlige, når dataene findes.
  show?: { food?: boolean; vitamins?: boolean };
};

export function formatInsightDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale as Locale), {
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

export function InsightPanel({ title, footnote, children }: { title: string; footnote?: string; children: React.ReactNode }) {
  return (
    <section className="hf-panel">
      <h3 className="hf-type-title">{title}</h3>
      {children}
      {footnote && <p className="hf-type-caption text-right">{footnote}</p>}
    </section>
  );
}

export function InsightKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="hf-kpi">
      <p className="hf-type-caption">{label}</p>
      <p className="hf-type-title">{value}</p>
    </div>
  );
}

export function InsightGrid({ data, layout }: { data: InsightData; layout?: InsightLayout }) {
  const { t, locale } = useTranslation();
  const noData = t("helloDoc.preview.noChartData");

  const weightPoints: MiniChartPoint[] =
    data.weight?.history.map((entry) => ({ label: formatInsightDate(entry.date, locale), value: entry.weightKg })) ?? [];
  const kcalPoints: MiniChartPoint[] = data.dailyNutrition?.map((day) => ({ label: day.dateKey, value: Math.round(day.kcal) })) ?? [];
  const fluidPoints: MiniChartPoint[] =
    data.fluidHistory?.map((entry) => ({ label: formatInsightDate(entry.date, locale), value: entry.valueMl })) ?? [];

  const totals = data.dailyNutrition?.reduce(
    (acc, day) => ({
      vitaminA: acc.vitaminA + day.vitaminA,
      vitaminC: acc.vitaminC + day.vitaminC,
      calcium: acc.calcium + day.calcium,
      iron: acc.iron + day.iron,
      potassium: acc.potassium + day.potassium,
    }),
    { vitaminA: 0, vitaminC: 0, calcium: 0, iron: 0, potassium: 0 },
  );
  const vitaminPoints: MiniChartPoint[] = totals
    ? [
        { label: "Vitamin A", value: Math.round(totals.vitaminA) },
        { label: "Vitamin C", value: Math.round(totals.vitaminC) },
        { label: "Calcium", value: Math.round(totals.calcium) },
        { label: "Jern", value: Math.round(totals.iron) },
        { label: "Kalium", value: Math.round(totals.potassium) },
      ]
    : [];

  const panels: Record<InsightPanelId, React.ReactNode> = {
    weight: data.weight && (
      <InsightPanel key="weight" title={t("helloDoc.preview.weightSection")}>
        <MiniLineChart points={weightPoints} unit=" kg" emptyLabel={noData} />
      </InsightPanel>
    ),
    food: data.dailyNutrition && data.show?.food !== false && (
      <InsightPanel key="food" title={t("helloDoc.preview.foodSection")} footnote={`${t("helloDoc.preview.kcalUnit")}/dag`}>
        <MiniBarChart points={kcalPoints} emptyLabel={noData} />
      </InsightPanel>
    ),
    vitamins: data.dailyNutrition && data.show?.vitamins !== false && (
      <InsightPanel key="vitamins" title={t("helloDoc.preview.vitaminsSection")}>
        <MiniBarChart points={vitaminPoints} color="var(--hf-color-appbar)" emptyLabel={noData} />
      </InsightPanel>
    ),
    fluid: data.fluidHistory && (
      <InsightPanel key="fluid" title={t("helloDoc.preview.fluidSection")}>
        <MiniBarChart points={fluidPoints} color="var(--hf-color-google)" emptyLabel={noData} />
      </InsightPanel>
    ),
  };

  return (
    <div className="hf-insight__grid">
      {(layout?.order ?? INSIGHT_PANELS).filter((id) => !layout?.hidden.includes(id)).map((id) => panels[id])}
    </div>
  );
}

export function HelloDocInsight({ data, greeting, layout }: { data: InsightData; greeting?: string; layout?: InsightLayout }) {
  const { t, locale } = useTranslation();
  const hasFacts = data.weight || data.goals || data.sleep;

  return (
    <div className="hf-insight__layout">
      <aside className="hf-insight__aside hf-card">
        {greeting && <p className="hf-type-body">{greeting}</p>}

        {data.profile && (
          <div className="hf-stack items-center text-center">
            <span className="hf-avatar-initials hf-type-page-title">{initials(data.profile.displayName)}</span>
            <p className="hf-type-title">{data.profile.displayName}</p>
            <p className="hf-type-caption">{data.profile.email}</p>
          </div>
        )}

        {hasFacts && (
          <div className="hf-insight__facts">
            {data.weight && (
              <div>
                <p className="hf-type-caption">{t("helloDoc.preview.startWeight")}</p>
                <p className="hf-type-body">{data.weight.startWeightKg != null ? `${data.weight.startWeightKg} kg` : "—"}</p>
                <p className="hf-type-caption">
                  {t("helloDoc.preview.recordedOn", { date: formatInsightDate(data.weight.startWeightRecordedAt, locale) })}
                </p>
              </div>
            )}
            {data.goals && (
              <div>
                <p className="hf-type-caption">{t("helloDoc.preview.startGoal")}</p>
                <p className="hf-type-body">{data.goals.targetWeightKg != null ? `${data.goals.targetWeightKg} kg` : "—"}</p>
              </div>
            )}
            {data.sleep && (
              <div>
                <p className="hf-type-caption">{t("helloDoc.preview.sleepSection")}</p>
                <p className="hf-type-body">
                  {t("helloDoc.preview.sleepBedtime")}: {data.sleep.defaultBedtime ?? t("helloDoc.preview.sleepNotSet")}
                </p>
                <p className="hf-type-body">
                  {t("helloDoc.preview.sleepWakeTime")}: {data.sleep.defaultWakeTime ?? t("helloDoc.preview.sleepNotSet")}
                </p>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="hf-insight__content">
        <InsightGrid data={data} layout={layout} />
      </div>
    </div>
  );
}
