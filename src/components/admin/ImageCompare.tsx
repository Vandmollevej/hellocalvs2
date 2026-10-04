"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatBytes, formatDimensions } from "@/lib/brand-logo-upload-types";
import { ROLE_LABEL, targetsLabel, type ProductImageUploadItem } from "@/lib/product-image-upload-types";

// "Vis forskel" for produktbilleder (admin → Billed-upload, docs/DECISIONS.md
// 2026-10-04): det nuværende og det nye billede side om side, så store som
// muligt. Fritlagte billeder har grå tern bag sig (ellers ville gennemsigtig
// baggrund se hvid ud). Under billederne ligger de samme knapper som på listen.

// Grå tern som baggrund på selve billedet (ikke på rammen), så ternene kun ses
// bag billedet og ikke i den tomme plads omkring det.
export const CHECKER_STYLE: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage: "conic-gradient(#d4d4d4 25%, #ffffff 0 50%, #d4d4d4 0 75%, #ffffff 0)",
  backgroundSize: "20px 20px",
};

// Lille billede (liste-miniature) med grå tern bag sig.
export function CheckerThumb({ src, alt, className = "h-12 w-16" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`hf-type-micro flex items-center justify-center rounded border border-hf-tan-dark bg-hf-tan text-text-muted ${className}`}>
        Intet
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded border border-hf-tan-dark bg-hf-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" style={CHECKER_STYLE} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

// Billedet fylder så meget af pladsen som muligt (også små billeder forstørres),
// uden at blive skævt, og tern-baggrunden dækker kun billedet.
function FitImage({ src, alt, onSize }: { src: string; alt: string; onSize: (width: number, height: number) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = box && natural ? Math.min(box.width / natural.width, box.height / natural.height) : null;
  return (
    <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-hf-tan-dark bg-hf-tan">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={(event) => {
          const width = event.currentTarget.naturalWidth;
          const height = event.currentTarget.naturalHeight;
          setNatural({ width, height });
          onSize(width, height);
        }}
        style={{
          ...CHECKER_STYLE,
          ...(scale && natural
            ? { width: Math.floor(natural.width * scale), height: Math.floor(natural.height * scale) }
            : { maxWidth: "100%", maxHeight: "100%" }),
        }}
      />
    </div>
  );
}

export function DiffDialog({
  item,
  canEdit,
  pending,
  onDecide,
  onClose,
}: {
  item: ProductImageUploadItem;
  canEdit: boolean;
  pending: boolean;
  onDecide: (decision: "ignore" | "replace") => void;
  onClose: () => void;
}) {
  const conflicting = item.targets.filter((target) => target.existingUrl);
  const existingUrl = conflicting[0]?.existingUrl ?? null;
  const [existingSize, setExistingSize] = useState<{ width: number; height: number } | null>(null);
  const [existingBytes, setExistingBytes] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Filstørrelsen på det nuværende billede kan kun læses fra vores egen server.
  useEffect(() => {
    if (!existingUrl || !existingUrl.startsWith("/")) return;
    const controller = new AbortController();
    fetch(existingUrl, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        const length = Number(response.headers.get("content-length"));
        if (response.ok && Number.isFinite(length) && length > 0) setExistingBytes(length);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [existingUrl]);

  const buttonClass = "hf-type-body hf-control rounded-md px-6 disabled:opacity-60";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Forskel for ${item.fileName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onClick={onClose}
    >
      <div className="flex h-full w-full max-w-[1900px] flex-col gap-3 rounded-lg bg-page-bg p-3 sm:p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="hf-type-card-title text-hf-black">
            {item.fileName}
            <span className="hf-type-body text-text-secondary">
              {" "}
              — {item.role ? ROLE_LABEL[item.role] : "Billede"} for {targetsLabel(item.targets) ?? "varen"}
            </span>
          </h2>
          {conflicting.length > 1 && (
            <p className="hf-type-small text-text-secondary">Viser billedet fra {conflicting[0].name}; {conflicting.length - 1} andre har også et billede.</p>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
          <figure className="flex min-h-0 flex-col gap-2">
            <figcaption className="hf-type-body hf-type-strong text-hf-black">Nuværende billede</figcaption>
            {existingUrl ? (
              <FitImage src={existingUrl} alt="Nuværende billede" onSize={(width, height) => setExistingSize({ width, height })} />
            ) : (
              <div className="hf-type-body flex min-h-0 flex-1 items-center justify-center rounded-md border border-hf-tan-dark bg-hf-tan text-text-muted">
                Intet nuværende billede
              </div>
            )}
            <p className="hf-type-small text-text-secondary">
              {existingSize ? formatDimensions(existingSize.width, existingSize.height) : "Henter…"}
              {existingBytes != null && ` · ${formatBytes(existingBytes)}`}
            </p>
          </figure>
          <figure className="flex min-h-0 flex-col gap-2">
            <figcaption className="hf-type-body hf-type-strong text-hf-black">
              Nyt billede{item.hasAlpha ? " (fritlagt)" : ""}
            </figcaption>
            {item.imageUrl ? (
              <FitImage src={item.imageUrl} alt="Nyt billede" onSize={() => undefined} />
            ) : (
              <div className="hf-type-body flex min-h-0 flex-1 items-center justify-center rounded-md border border-hf-tan-dark bg-hf-tan text-text-muted">
                Filen findes ikke længere
              </div>
            )}
            <p className="hf-type-small text-text-secondary">
              {formatDimensions(item.width, item.height)} · {formatBytes(item.bytes)}
              {item.originalBytes ? ` (original ${formatDimensions(item.originalWidth, item.originalHeight)}, ${formatBytes(item.originalBytes)})` : ""}
            </p>
          </figure>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {canEdit && item.status === "CONFLICT" && (
            <>
              <button type="button" disabled={pending} onClick={() => onDecide("ignore")} className={`${buttonClass} border border-hf-tan-dark bg-hf-white text-hf-black`}>
                Ignorer
              </button>
              <button type="button" disabled={pending} onClick={() => onDecide("replace")} className={`${buttonClass} bg-hf-green-dark text-hf-white`}>
                Erstat
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className={`${buttonClass} border border-hf-tan-dark bg-hf-white text-hf-black`}>
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}
