"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCamera, IconCheck, IconMinus, IconQuestionMark, IconSettings } from "@tabler/icons-react";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { useScanPosition } from "@/components/scan/ScanLocation";
import { ShelfItemSheet, type ShelfItem } from "@/components/scan/ShelfItemSheet";
import { downscaleImageFile } from "@/components/scan/image";

// "Billede af hylde" (docs/OPRETTELSES-APP.md): seneste hyldebillede med
// overlay — grønt flueben (findes), minus (mangler) eller spørgsmålstegn
// (usikkert match) pr. produkt, med 1 px kant om varen. Swipe mellem alle
// tidligere billeder (nyeste først). Kamera-cirkel øverst til venstre tager
// et nyt billede; tandhjulet øverst til højre sletter det viste billede.

type ShelfPhoto = {
  id: string;
  imageUrl: string;
  capturedAt: string;
  storeName: string | null;
  analysisStatus: "PENDING" | "DONE" | "FAILED";
  items: ShelfItem[];
};

const STATUS_STYLE = {
  EXISTS: { border: "var(--hf-color-brand)", badge: "var(--hf-color-brand)", Icon: IconCheck, label: "Oprettet" },
  MISSING: { border: "var(--hf-color-white)", badge: "var(--hf-color-action)", Icon: IconMinus, label: "Mangler" },
  UNCERTAIN: { border: "var(--hf-color-positive)", badge: "var(--hf-color-inactive)", Icon: IconQuestionMark, label: "Usikkert match" },
} as const;

function Slide({ photo, onSelect }: { photo: ShelfPhoto; onSelect: (item: ShelfItem) => void }) {
  return (
    <div className="h-full w-full flex-none snap-center overflow-y-auto">
      <div className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt="Hyldebillede" className="block h-auto w-full" draggable={false} />
        {photo.items.map((item) => {
          const style = STATUS_STYLE[item.status];
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.detectedBrand ?? ""} ${item.detectedName} — ${style.label}`}
              onClick={() => onSelect(item)}
              className="absolute"
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.w * 100}%`,
                height: `${item.h * 100}%`,
                border: `1px solid ${style.border}`,
              }}
            >
              <span
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: style.badge, color: "var(--hf-color-white)" }}
              >
                <style.Icon size={14} stroke={3} />
              </span>
            </button>
          );
        })}
        {photo.analysisStatus === "PENDING" && (
          <div className="absolute inset-x-0 bottom-0 bg-hf-black/60 p-2 text-center">
            <span className="hf-type-caption" style={{ color: "var(--hf-color-white)" }}>
              Analyserer hylden…
            </span>
          </div>
        )}
        {photo.analysisStatus === "FAILED" && (
          <div className="absolute inset-x-0 bottom-0 bg-hf-black/60 p-2 text-center">
            <span className="hf-type-caption" style={{ color: "var(--hf-color-white)" }}>
              Analysen fejlede — tag billedet igen
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ShelfContent() {
  const position = useScanPosition();
  const [photos, setPhotos] = useState<ShelfPhoto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShelfItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/scan/shelf-photos");
    if (response.ok) setPhotos(((await response.json()) as { photos: ShelfPhoto[] }).photos);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Poll så længe et billede stadig analyseres.
  const hasPending = photos?.some((photo) => photo.analysisStatus === "PENDING") ?? false;
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [hasPending, load]);

  async function handleFile(file: File) {
    if (!position) return;
    setUploading(true);
    setError(null);
    try {
      const photo = await downscaleImageFile(file, 2400);
      const response = await fetch("/api/scan/shelf-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, ...position, capturedAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { message?: string }).message);
      const data = (await response.json()) as { photo: ShelfPhoto };
      setPhotos((prev) => [data.photo, ...(prev ?? [])]);
      setIndex(0);
      scrollRef.current?.scrollTo({ left: 0 });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Billedet kunne ikke gemmes");
    } finally {
      setUploading(false);
    }
  }

  async function deleteCurrent() {
    const current = photos?.[index];
    setConfirmDelete(false);
    if (!current) return;
    const response = await fetch(`/api/scan/shelf-photos/${current.id}`, { method: "DELETE" });
    if (response.ok) {
      setPhotos((prev) => (prev ?? []).filter((photo) => photo.id !== current.id));
      setIndex((i) => Math.max(0, i - 1));
    }
  }

  const current = photos?.[index];

  return (
    <div className="relative flex h-full flex-col bg-hf-black">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {photos?.map((photo) => <Slide key={photo.id} photo={photo} onSelect={setSelected} />)}
        {photos && photos.length === 0 && (
          <div className="flex w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>
              Tag et billede af en hylde med kameraknappen øverst til venstre.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Tag nyt hyldebillede"
        disabled={uploading || !position}
        onClick={() => fileRef.current?.click()}
        className="absolute left-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-hf-white text-hf-black shadow disabled:opacity-60"
      >
        <IconCamera size={24} stroke={2} />
      </button>
      {current && (
        <button
          type="button"
          aria-label="Slet billedet"
          onClick={() => setConfirmDelete(true)}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-hf-black/60 text-hf-white"
        >
          <IconSettings size={20} stroke={2} />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {current && (
        <div className="flex items-center justify-between bg-hf-black px-4 py-2">
          <span className="hf-type-caption" style={{ color: "var(--hf-color-white)" }}>
            {new Date(current.capturedAt).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })}
            {current.storeName ? ` · ${current.storeName}` : ""}
          </span>
          <span className="hf-type-caption" style={{ color: "var(--hf-color-white)" }}>
            {index + 1} / {photos?.length}
          </span>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-hf-black/60">
          <span className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>
            Gemmer billede…
          </span>
        </div>
      )}
      {error && (
        <p className="hf-type-caption absolute inset-x-4 top-16 rounded-[8px] bg-hf-white p-2 text-center">{error}</p>
      )}

      {confirmDelete && (
        <div className="absolute inset-0 z-20 flex items-end bg-hf-black/40" onClick={() => setConfirmDelete(false)}>
          <div className="flex w-full flex-col gap-3 rounded-t-[12px] bg-hf-cream p-4" onClick={(event) => event.stopPropagation()}>
            <h2 className="hf-type-section-title">Slet billedet?</h2>
            <p className="hf-type-body">Billedet slettes helt og kan ikke gendannes. Oprettede varer bevares.</p>
            <button type="button" className="hf-btn-primary h-12 w-full" onClick={() => void deleteCurrent()}>
              <span className="hf-type-button">Slet billede</span>
            </button>
            <button type="button" className="hf-btn-secondary h-12 w-full" onClick={() => setConfirmDelete(false)}>
              <span className="hf-type-button">Annullér</span>
            </button>
          </div>
        </div>
      )}

      {selected && (
        <ShelfItemSheet
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

export default function ScanShelfPage() {
  return (
    <ScanScreen title="Billede af hylde">
      <ShelfContent />
    </ScanScreen>
  );
}
