"use client";

import { MiniBarChart, MiniLineChart, type MiniChartPoint } from "@/components/hf/MiniChart";
import { useTranslation } from "@/i18n/LocaleProvider";

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

export function InsightGrid({ data }: { data: InsightData }) {
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

  return (
    <div className="hf-insight__grid">
      {data.weight && (
        <InsightPanel title={t("helloDoc.preview.weightSection")}>
          <MiniLineChart points={weightPoints} unit=" kg" emptyLabel={noData} />
        </InsightPanel>
      )}
      {data.dailyNutrition && data.show?.food !== false && (
        <InsightPanel title={t("helloDoc.preview.foodSection")} footnote={`${t("helloDoc.preview.kcalUnit")}/dag`}>
          <MiniBarChart points={kcalPoints} emptyLabel={noData} />
        </InsightPanel>
      )}
      {data.dailyNutrition && data.show?.vitamins !== false && (
        <InsightPanel title={t("helloDoc.preview.vitaminsSection")}>
          <MiniBarChart points={vitaminPoints} color="var(--hf-color-appbar)" emptyLabel={noData} />
        </InsightPanel>
      )}
      {data.fluidHistory && (
        <InsightPanel title={t("helloDoc.preview.fluidSection")}>
          <MiniBarChart points={fluidPoints} color="var(--hf-color-google)" emptyLabel={noData} />
        </InsightPanel>
      )}
    </div>
  );
}

export function HelloDocInsight({ data, greeting }: { data: InsightData; greeting?: string }) {
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
        <InsightGrid data={data} />
      </div>
    </div>
  );
}
