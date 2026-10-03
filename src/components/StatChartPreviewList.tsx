"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj til statistik": graferne vises i fuld bredde og præcis som de vil
// se ud på statistiksiden (samme tegner, samme data), med en "+ Tilføj"-knap
// under hver. Grafens egen dropdown kan bruges, før den tilføjes.
export function StatChartPreviewList({
  keys,
  renderChart,
  onAdd,
}: {
  keys: string[];
  renderChart: (key: string) => React.ReactNode;
  onAdd: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      {keys.map((key) => (
        <div key={key} className="flex flex-col gap-2">
          {renderChart(key)}
          <button type="button" onClick={() => onAdd(key)} className="hf-btn-secondary h-12 w-full px-4">
            {t("statUnusedCards.add")}
          </button>
        </div>
      ))}
    </div>
  );
}
