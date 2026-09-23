"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NUTRITION_REPORT_FIELD_LABEL, type NutritionReportChange } from "@/lib/nutrition-reports";

type NutritionReport = {
  id: string;
  confidence: number;
  amountGrams: number;
  createdAt: string;
  canReply: boolean;
  changes: NutritionReportChange[];
};

const formatGrams = (value: number) =>
  `${value.toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} g`;

function ReportRow({ report }: { report: NutritionReport }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  // Forsegles server-side til indberetterens indbakke; admin ser aldrig hvem
  // modtageren er (docs/PRIVACY.md).
  async function sendMessage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/nutrition-reports/${report.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error();
      setMessage("");
      setMessageSent(true);
    } catch {
      setError("Kunne ikke sende beskeden");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/nutrition-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Kunne ikke gemme afgørelsen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
          Næringsindhold
          <span className="rounded-full bg-hf-gray-light px-2 py-0.5 text-xs font-medium text-hf-gray-dark">
            Brugerindberettet
          </span>
        </span>
        <span className="rounded-full bg-hf-tan px-2 py-0.5 text-xs font-medium text-text-primary">
          Confidence {Math.round(report.confidence)}%
        </span>
      </div>
      <p className="text-xs text-text-secondary">
        Anonym bruger · {new Date(report.createdAt).toLocaleString("da-DK")} · registreret{" "}
        {Math.round(report.amountGrams)} g · værdier pr. 100 g
      </p>

      <div className="flex flex-col gap-1.5">
        {report.changes.map((change) => (
          <div key={change.field} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-text-primary">{NUTRITION_REPORT_FIELD_LABEL[change.field]}</span>
            <span className="text-text-secondary">
              Før: {formatGrams(change.before)} · Bruger:{" "}
              <span className="font-medium text-text-primary">{formatGrams(change.reported)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("APPROVE")}
          className="hf-btn-primary px-3 py-1 text-xs"
        >
          Godkend
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("REJECT")}
          className="hf-btn-secondary px-3 py-1 text-xs"
        >
          Afvis
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-strong pt-2">
        {report.canReply ? (
          <>
            <textarea
              value={message}
              disabled={busy}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Besked til indberetteren"
              rows={2}
              className="rounded-md border border-border-strong px-2 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || !message.trim()}
                onClick={sendMessage}
                className="hf-btn-secondary px-3 py-1 text-xs"
              >
                Send besked
              </button>
              {messageSent && <span className="text-xs text-text-secondary">Besked sendt krypteret</span>}
            </div>
          </>
        ) : (
          <p className="text-xs text-text-secondary">Indberetteren kan ikke kontaktes.</p>
        )}
      </div>

      {error && <p className="text-xs text-hf-red-dark">{error}</p>}
    </div>
  );
}

// Ventende brugerindberettede næringsændringer på ét produkt (docs/DECISIONS.md
// 2026-09-23). Godkend skriver brugerens værdier til produktet; Afvis lader
// produktet være uændret.
export function NutritionReportPanel({ reports }: { reports: NutritionReport[] }) {
  if (reports.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
      <h2 className="text-sm font-semibold text-text-primary">
        {reports.length === 1 ? "1 brugerindberetning" : `${reports.length} brugerindberetninger`}
      </h2>
      {reports.map((report) => (
        <ReportRow key={report.id} report={report} />
      ))}
    </div>
  );
}
