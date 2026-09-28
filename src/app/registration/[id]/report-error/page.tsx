"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  buildReportDescription,
  reportPointsFor,
  type ReportPoint,
  type ReportPointKey,
} from "@/lib/registration-report-points";

type Registration = { id: string; productId: string | null; titleSnapshot: string };

// "Indberet fejl" for a daily-list entry (reached via the "Fejl" swipe action
// in src/components/SwipeableRow.tsx). Step 3 of the user's spec — "vælg
// fejlsted": every relevant point of the product gets a green circle with an
// exclamation mark; tapping it selects exactly that area and opens an inline
// field for the correction. The report is filed as an ordinary product
// BugReport (same admin queue, same one-pending-per-product rule).
export default function RegistrationReportErrorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();

  const [points, setPoints] = useState<ReportPoint[] | null | undefined>(undefined);
  const [productId, setProductId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Partial<Record<ReportPointKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"sent" | "pending" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const regRes = await fetch(`/api/registrations/${id}`);
        const reg: Registration | null = regRes.ok ? (await regRes.json()).registration : null;
        if (!reg?.productId) {
          if (!cancelled) setPoints(null);
          return;
        }
        const prodRes = await fetch(`/api/products/${reg.productId}`);
        const product = prodRes.ok ? (await prodRes.json()).product : null;
        if (cancelled) return;
        setProductId(reg.productId);
        setPoints(product ? reportPointsFor(product) : null);
      } catch {
        if (!cancelled) setPoints(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function togglePoint(key: ReportPointKey) {
    setNotes((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = "";
      return next;
    });
  }

  const selected = (points ?? []).filter((p) => p.key in notes);
  const canSubmit = selected.length > 0 && selected.every((p) => (notes[p.key] ?? "").trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          description: buildReportDescription(selected.map((p) => ({ label: t(p.labelKey), note: notes[p.key] ?? "" }))),
          categories: [...new Set(selected.flatMap((p) => (p.category ? [p.category] : [])))],
        }),
      });
      if (response.status === 409) {
        setResult("pending");
      } else if (response.ok) {
        setResult("sent");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.message ?? t("registrationReportError.submitFailed"));
      }
    } catch {
      setError(t("registrationReportError.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <HfScreen title={t("registrationReportError.title")}>
      <div className="px-4 pt-4 pb-8">
        {points === undefined ? (
          <p className="hf-type-body text-text-secondary mt-8 text-center">{t("common.loading")}</p>
        ) : points === null ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="hf-type-body text-text-secondary">{t("registrationReportError.noProduct")}</p>
            <Link href="/profile/report-bug" className="hf-control hf-btn-secondary w-full">
              {t("registrationReportError.generalReport")}
            </Link>
          </div>
        ) : result ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <p className="hf-type-body">
              {t(result === "sent" ? "registrationReportError.sent" : "registrationReportError.alreadyPending")}
            </p>
            {result === "pending" && (
              <Link href={`/profile/report-bug?productId=${productId}`} className="hf-control hf-btn-secondary w-full">
                {t("registrationReportError.editPending")}
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="hf-type-body text-text-secondary">{t("registrationReportError.intro")}</p>
            <ul className="flex flex-col">
              {points.map((point) => {
                const isSelected = point.key in notes;
                return (
                  <li key={point.key} className="border-b border-hf-tan-dark py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="hf-type-label">{t(point.labelKey)}</p>
                        {point.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={point.imageUrl} alt="" className="mt-1 h-16 w-16 rounded-[8px] object-cover" />
                        ) : (
                          <p className="hf-type-body text-text-secondary break-words">
                            {point.value || t("registrationReportError.missingValue")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePoint(point.key)}
                        aria-pressed={isSelected}
                        aria-label={t("registrationReportError.selectPoint", { point: t(point.labelKey) })}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                        style={{
                          background: isSelected ? "var(--hf-color-brand)" : "transparent",
                          border: "2px solid var(--hf-color-brand)",
                          color: isSelected ? "#fff" : "var(--hf-color-brand)",
                        }}
                      >
                        !
                      </button>
                    </div>
                    {isSelected && (
                      <textarea
                        autoFocus
                        rows={2}
                        value={notes[point.key] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [point.key]: e.target.value }))}
                        placeholder={t("registrationReportError.correctionPlaceholder")}
                        className="hf-type-input mt-2 w-full rounded-[4px] border bg-hf-cream p-3 outline-none"
                        style={{ borderColor: "var(--hf-color-field-border)" }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="hf-control hf-btn-primary w-full disabled:opacity-50"
            >
              {submitting ? t("registrationReportError.sending") : t("registrationReportError.submit")}
            </button>
          </form>
        )}
      </div>
    </HfScreen>
  );
}
