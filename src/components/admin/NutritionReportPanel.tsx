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
    <div className="flex flex-col gap-4 rounded-lg border border-hf-tan-dark p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="hf-type-body hf-type-strong flex items-center gap-1.5 text-hf-black">
          Næringsindhold
          <span className="hf-type-small hf-type-strong rounded-full bg-hf-tan-dark px-2 py-0.5 text-text-secondary">
            Brugerindberettet
          </span>
        </span>
        <span className="hf-type-small hf-type-strong rounded-full bg-hf-tan px-2 py-0.5 text-hf-black">
          Confidence {Math.round(report.confidence)}%
        </span>
      </div>
      <p className="hf-type-small text-text-secondary">
        Anonym bruger · {new Date(report.createdAt).toLocaleString("da-DK")} · registreret{" "}
        {Math.round(report.amountGrams)} g · værdier pr. 100 g
      </p>

      <div className="flex flex-col gap-2">
        {report.changes.map((change) => (
          <div key={change.field} className="hf-type-body flex items-baseline justify-between gap-2">
            <span className="text-hf-black">{NUTRITION_REPORT_FIELD_LABEL[change.field]}</span>
            <span className="text-text-secondary">
              Før: {formatGrams(change.before)} · Bruger:{" "}
              <span className="hf-type-strong text-hf-black">{formatGrams(change.reported)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("APPROVE")}
          className="hf-btn-primary px-3 py-1"
        >
          Godkend
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("REJECT")}
          className="hf-btn-secondary px-3 py-1"
        >
          Afvis
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-hf-tan-dark pt-2">
        {report.canReply ? (
          <>
            <textarea
              value={message}
              disabled={busy}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Besked til indberetteren"
              rows={2}
              className="hf-type-small rounded-md border border-hf-tan-dark px-2 py-1"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || !message.trim()}
                onClick={sendMessage}
                className="hf-btn-secondary px-3 py-1"
              >
                Send besked
              </button>
              {messageSent && <span className="hf-type-small text-text-secondary">Besked sendt krypteret</span>}
            </div>
          </>
        ) : (
          <p className="hf-type-small text-text-secondary">Indberetteren kan ikke kontaktes.</p>
        )}
      </div>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </div>
  );
}

// Ventende brugerindberettede næringsændringer på ét produkt (docs/DECISIONS.md
// 2026-09-23). Godkend skriver brugerens værdier til produktet; Afvis lader
// produktet være uændret.
export function NutritionReportPanel({ reports }: { reports: NutritionReport[] }) {
  if (reports.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
      <h2 className="hf-type-body hf-type-strong text-hf-black">
        {reports.length === 1 ? "1 brugerindberetning" : `${reports.length} brugerindberetninger`}
      </h2>
      {reports.map((report) => (
        <ReportRow key={report.id} report={report} />
      ))}
    </div>
  );
}
