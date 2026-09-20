"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

type Row = {
  id: string;
  productId: string;
  productName: string;
  brandName: string | null;
  photoType: "BARCODE" | "NUTRITION" | "INGREDIENTS";
  confidence: number | null;
  createdAt: string;
  usageLast30Days: number;
};

const PHOTO_TYPE_LABEL: Record<Row["photoType"], string> = {
  BARCODE: "Stregkodefoto",
  NUTRITION: "Næringsfoto",
  INGREDIENTS: "Ingrediensfoto",
};

type ConfidenceFilter = "under80" | "0-50" | "50-80" | "80-100" | "all";
type SortKey = "date" | "confidence" | "usage";

function matchesFilter(confidence: number | null, filter: ConfidenceFilter) {
  if (confidence === null) return filter === "all" || filter === "under80";
  switch (filter) {
    case "under80":
      return confidence < 80;
    case "0-50":
      return confidence < 50;
    case "50-80":
      return confidence >= 50 && confidence < 80;
    case "80-100":
      return confidence >= 80;
    case "all":
      return true;
  }
}

export function QualityControlTable({ rows, locale }: { rows: Row[]; locale: Locale }) {
  const router = useRouter();
  const [filter, setFilter] = useState<ConfidenceFilter>("under80");
  // Standardsortering (docs/DECISIONS.md 2026-09-19): flest anvendelser
  // sidste 30 dage først, lavest confidence som anden nøgle — så et produkt
  // der rammer mange brugere altid ligger over et sjældent produkt med
  // samme eller lavere confidence.
  const [sortKey, setSortKey] = useState<SortKey>("usage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => matchesFilter(row.confidence, filter));
    const sorted = [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "date") diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortKey === "confidence") diff = (a.confidence ?? -1) - (b.confidence ?? -1);
      if (sortKey === "usage") {
        diff = a.usageLast30Days - b.usageLast30Days;
        if (diff === 0) diff = (a.confidence ?? 101) - (b.confidence ?? 101);
      }
      return sortDir === "asc" ? diff : -diff;
    });
    return sorted;
  }, [rows, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : key === "usage" ? "desc" : "asc");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 text-xs">
        {(["under80", "0-50", "50-80", "80-100", "all"] as ConfidenceFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            className={`rounded-md border px-2.5 py-1 ${
              filter === option
                ? "border-hf-green-dark bg-hf-green-dark text-hf-white"
                : "border-border-strong text-text-secondary hover:bg-hf-tan"
            }`}
          >
            {option === "under80" ? "< 80%" : option === "all" ? t(locale, "quality_control_filter_all") : option}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-strong">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs text-text-secondary">
            <tr>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("date")}>
                {t(locale, "quality_control_col_date")}
              </th>
              <th className="px-3 py-2">{t(locale, "quality_control_col_product")}</th>
              <th className="px-3 py-2">{t(locale, "quality_control_col_issue")}</th>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("confidence")}>
                {t(locale, "quality_control_col_confidence")}
              </th>
              <th className="cursor-pointer px-3 py-2" onClick={() => toggleSort("usage")}>
                {t(locale, "quality_control_col_usage")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/admin/products/${row.productId}`)}
                className="cursor-pointer border-t border-border-strong hover:bg-hf-tan"
              >
                <td className="px-3 py-2 text-text-secondary">
                  {new Date(row.createdAt).toLocaleDateString("da-DK")}
                </td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {row.brandName ? `${row.brandName} ${row.productName}` : row.productName}
                </td>
                <td className="px-3 py-2 text-text-secondary">{PHOTO_TYPE_LABEL[row.photoType]}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.confidence === null
                        ? "bg-hf-gray-light text-hf-gray-dark"
                        : row.confidence < 50
                        ? "bg-hf-red-muted text-hf-white"
                        : row.confidence < 80
                        ? "bg-hf-tan-dark text-hf-black"
                        : "bg-hf-green-light text-hf-green-dark"
                    }`}
                  >
                    {row.confidence === null ? "—" : `${Math.round(row.confidence)}%`}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{row.usageLast30Days.toLocaleString("da-DK")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
