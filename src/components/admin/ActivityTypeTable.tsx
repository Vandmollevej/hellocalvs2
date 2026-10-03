"use client";

import { useState } from "react";
import type { Locale } from "@prisma/client";
import { t, type AdminI18nKey } from "@/lib/admin-i18n";

export type ActivityTypeRow = {
  id: string | null;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "BUILTIN";
  uses: number;
  createdAt: string | null;
};

// Liste over aktiviteter med Godkend/Afvis som små teksthandlinger (samme
// stil som delte retter). Bruges af Kvalitetskontrol → Aktiviteter (kun
// ventende) og /admin/activities (alle).
export function ActivityTypeTable({ rows, locale }: { rows: ActivityTypeRow[]; locale: Locale }) {
  const [status, setStatus] = useState<Record<string, ActivityTypeRow["status"]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    const res = await fetch(`/api/admin/activities/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setBusyId(null);
    if (res?.ok) setStatus((current) => ({ ...current, [id]: action === "APPROVE" ? "APPROVED" : "REJECTED" }));
  }

  return (
    <div className="hf-table-scroll"><table className="hf-type-small w-full text-left">
      <thead className="text-text-secondary">
        <tr>
          <th className="py-2">{t(locale, "activities_col_name")}</th>
          <th className="py-2">{t(locale, "activities_col_status")}</th>
          <th className="py-2 text-right">{t(locale, "activities_col_uses")}</th>
          <th className="py-2">{t(locale, "activities_col_created")}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const current = (row.id && status[row.id]) || row.status;
          return (
            <tr key={row.id ?? row.name} className="border-t border-hf-tan-dark">
              <td className="py-2 text-hf-black">{row.name}</td>
              <td className="py-2">
                {current === "BUILTIN" ? t(locale, "activities_builtin") : t(locale, `activities_status_${current}` as AdminI18nKey)}
              </td>
              <td className="py-2 text-right">{row.uses}</td>
              <td className="py-2">
                {row.createdAt ? new Date(row.createdAt).toLocaleDateString(locale === "EN" ? "en-GB" : "da-DK") : "—"}
              </td>
              <td className="hf-type-strong py-2">
                {row.id && current !== "BUILTIN" && (
                  <span className="flex justify-end gap-4">
                    {current !== "APPROVED" && (
                      <button type="button" className="hf-btn-text text-hf-black disabled:opacity-40" disabled={busyId === row.id} onClick={() => decide(row.id!, "APPROVE")}>
                        {t(locale, "activities_approve")}
                      </button>
                    )}
                    {current !== "REJECTED" && (
                      <button type="button" className="hf-btn-text text-hf-black disabled:opacity-40" disabled={busyId === row.id} onClick={() => decide(row.id!, "REJECT")}>
                        {t(locale, "activities_reject")}
                      </button>
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}
