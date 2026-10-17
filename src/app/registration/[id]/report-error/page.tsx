"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { IconBarcode, IconCamera } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  buildReportSections,
  reportPointsFor,
  type ReportCapture,
  type ReportPoint,
  type ReportPointKey,
} from "@/lib/registration-report-points";
import { imageThumb } from "@/lib/image-thumb";
import { fileToDownscaledDataUrl } from "@/lib/image-downscale";

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
  // Photo taken with the point's own camera button (user rule 2026-10-17).
  const [photos, setPhotos] = useState<Partial<Record<ReportPointKey, string>>>({});
  const [capturing, setCapturing] = useState<ReportPointKey | null>(null);
  const [captureError, setCaptureError] = useState<Partial<Record<ReportPointKey, string>>>({});
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
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // The camera button selects the point and attaches the photo; for EAN the
  // barcode is read from the photo and written into the note.
  async function handleCapture(point: ReportPoint, files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const key = point.key;
    setCapturing(key);
    setCaptureError((prev) => ({ ...prev, [key]: undefined }));
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      let note: string | null = null;
      if (point.capture === "barcode") {
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const code = (await new BrowserMultiFormatReader().decodeFromImageUrl(dataUrl)).getText();
          note = t("registrationReportError.barcodeRead", { code });
        } catch {
          setCaptureError((prev) => ({ ...prev, [key]: t("registrationReportError.barcodeUnreadable") }));
        }
      }
      setPhotos((prev) => ({ ...prev, [key]: dataUrl }));
      setNotes((prev) => ({ ...prev, [key]: note && !prev[key]?.trim() ? note : (prev[key] ?? "") }));
    } catch {
      setCaptureError((prev) => ({ ...prev, [key]: t("registrationReportError.photoFailed") }));
    } finally {
      setCapturing(null);
    }
  }

  function removePhoto(key: ReportPointKey) {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const selected = (points ?? []).filter((p) => p.key in notes);
  const canSubmit =
    selected.length > 0 && selected.every((p) => (notes[p.key] ?? "").trim().length > 0 || Boolean(photos[p.key]));

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
          ...buildReportSections(
            selected.map((p) => ({ key: p.key, label: t(p.labelKey), note: notes[p.key] ?? "", photo: photos[p.key] }))
          ),
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

  const showForm = Boolean(points) && !result;

  return (
    <HfScreen
      title={t("registrationReportError.title")}
      footer={
        showForm ? (
          // Fast nederst over bundcirklen (REGLER: knapper nederst), aldrig bag den.
          <button
            type="submit"
            form="report-error-form"
            disabled={!canSubmit || submitting}
            className="hf-control hf-btn-primary w-full"
          >
            {submitting ? t("registrationReportError.sending") : t("registrationReportError.submit")}
          </button>
        ) : undefined
      }
    >
      <div className="px-4 pt-4 pb-8">
        {points === undefined ? (
          <p className="hf-type-body text-text-secondary mt-8 text-center">{t("common.loading")}</p>
        ) : points === null ? (
          <div className="hf-report-empty">
            <p className="hf-type-body text-text-secondary">{t("registrationReportError.noProduct")}</p>
            <Link href="/profile/report-bug" className="hf-control hf-btn-secondary w-full">
              {t("registrationReportError.generalReport")}
            </Link>
          </div>
        ) : result ? (
          <div className="hf-report-empty">
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
          <form id="report-error-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                          <img src={imageThumb(point.imageUrl, 128)} alt="" className="mt-1 h-16 w-16 object-cover rounded-card" />
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hf-type-title hf-type-strong"
                        style={{
                          background: isSelected ? "var(--hf-color-brand)" : "transparent",
                          border: "2px solid var(--hf-color-brand)",
                          color: isSelected ? "#fff" : "var(--hf-color-brand)",
                        }}
                      >
                        !
                      </button>
                    </div>
                    {point.capture && (
                      <CaptureButton
                        capture={point.capture}
                        busy={capturing === point.key}
                        hasPhoto={Boolean(photos[point.key])}
                        onFiles={(files) => void handleCapture(point, files)}
                      />
                    )}
                    {photos[point.key] && (
                      <div className="mt-2 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photos[point.key]} alt="" className="h-16 w-16 object-cover rounded-card" />
                        <button type="button" onClick={() => removePhoto(point.key)} className="hf-btn-text">
                          {t("registrationReportError.removePhoto")}
                        </button>
                      </div>
                    )}
                    {captureError[point.key] && (
                      <p className="hf-type-caption text-hf-red-dark mt-1">{captureError[point.key]}</p>
                    )}
                    {isSelected && (
                      <textarea
                        autoFocus={!photos[point.key]}
                        rows={2}
                        value={notes[point.key] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [point.key]: e.target.value }))}
                        placeholder={t("registrationReportError.correctionPlaceholder")}
                        className="hf-textarea-auth hf-type-input mt-2"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
          </form>
        )}
      </div>
    </HfScreen>
  );
}

const CAPTURE_LABEL: Record<ReportCapture, string> = {
  photo: "registrationReportError.capturePhoto",
  barcode: "registrationReportError.captureBarcode",
  nutrition: "registrationReportError.captureNutrition",
};

// Direct camera button under Produktbillede, EAN and Energi.
function CaptureButton({
  capture,
  busy,
  hasPhoto,
  onFiles,
}: {
  capture: ReportCapture;
  busy: boolean;
  hasPhoto: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const { t } = useTranslation();
  const Icon = capture === "barcode" ? IconBarcode : IconCamera;
  return (
    <label className="hf-control hf-btn-secondary mt-2 flex w-full cursor-pointer items-center justify-center gap-2">
      <Icon size={20} stroke={1.75} />
      {busy
        ? t("registrationReportError.reading")
        : hasPhoto
          ? t("registrationReportError.retake")
          : t(CAPTURE_LABEL[capture])}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        disabled={busy}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}
