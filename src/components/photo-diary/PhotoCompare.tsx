"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconArrowsLeftRight, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatPhotoDay, type DiaryPhoto } from "@/lib/photo-diary";
import { afterCandidates } from "@/lib/photo-compare";
import { PhotoCompareSlider } from "@/components/photo-diary/PhotoCompareSlider";
import { PhotoSelectBox } from "@/components/photo-diary/PhotoSelectBox";

type Step = "slots" | "pick" | "compare";

// Før/efter i billede-dagbogen (2026-10-02). Åbner, når et billede er krydset
// af i karrusellen:
// 1. "slots": billede 1 står til venstre med et 1-tal; til højre er en tom
//    plads med "Efter"-knappen i midten.
// 2. "pick": alle andre billeder i et gitter med hvide afkrydsningsbokse —
//    tryk på det, der skal være billede 2.
// 3. "compare": de to billeder lagt oven på hinanden med en skyder imellem.
// Samme mørke fuldskærm som PhotoViewer, så den virker ens på telefon og
// computer.
export function PhotoCompare({
  photos,
  firstId,
  onClose,
}: {
  // Ældste først.
  photos: DiaryPhoto[];
  firstId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [beforeId, setBeforeId] = useState(firstId);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const before = photos.find((photo) => photo.id === beforeId) ?? null;
  const after = afterId ? (photos.find((photo) => photo.id === afterId) ?? null) : null;
  const step: Step = picking ? "pick" : after ? "compare" : "slots";
  const candidates = afterCandidates(photos, beforeId);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (picking) setPicking(false);
      else onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [picking, onClose]);

  if (!before) return null;

  function chooseAfter(id: string) {
    setAfterId(id);
    setPicking(false);
  }

  function swap() {
    if (!afterId) return;
    setBeforeId(afterId);
    setAfterId(beforeId);
  }

  const title =
    step === "pick" ? t("photoDiary.compare.pickAfterTitle") : t("photoDiary.compare.title");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-hf-black text-hf-white"
    >
      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        {step === "pick" ? (
          <button
            type="button"
            onClick={() => setPicking(false)}
            aria-label={t("common.back")}
            className="hf-btn-icon"
          >
            <IconArrowLeft size={24} />
          </button>
        ) : (
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="hf-btn-icon">
            <IconX size={24} />
          </button>
        )}
        <p className="hf-type-card-title truncate text-center">{title}</p>
        {step === "compare" ? (
          <button
            type="button"
            onClick={swap}
            aria-label={t("photoDiary.compare.swap")}
            className="hf-btn-icon"
          >
            <IconArrowsLeftRight size={22} />
          </button>
        ) : (
          <span aria-hidden />
        )}
      </div>

      {step === "slots" && (
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col justify-center gap-4 overflow-y-auto px-4">
          <div className="grid grid-cols-2 gap-4">
            <SlotLabel number={1} label={t("photoDiary.compare.before")} date={formatPhotoDay(before.takenAt)} />
            <SlotLabel number={2} label={t("photoDiary.compare.after")} />
            <div className="relative overflow-hidden rounded-2xl bg-hf-black aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={before.url}
                alt={`${t("photoDiary.compare.before")}, ${formatPhotoDay(before.takenAt)}`}
                draggable={false}
                className="h-full w-full object-cover"
              />
              <PhotoSelectBox
                checked
                number={1}
                label={t("photoDiary.compare.unselectBefore")}
                onToggle={onClose}
              />
            </div>
            <div
              className="flex items-center justify-center rounded-2xl border-2 border-dashed border-hf-white/50 aspect-[3/4]"
            >
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-label={t("photoDiary.compare.pickAfterTitle")}
                className="hf-photo-pill"
              >
                <IconPlus size={18} stroke={2.5} />
                {t("photoDiary.compare.after")}
              </button>
            </div>
          </div>
          <p className="hf-type-small text-center text-hf-white/70">{t("photoDiary.compare.firstSelectedHint")}</p>
        </div>
      )}

      {step === "pick" && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="hf-type-small mb-4 text-center text-hf-white/70">{t("photoDiary.compare.pickAfterHint")}</p>
          <ul className="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((photo) => {
              const selected = photo.id === afterId;
              const day = formatPhotoDay(photo.takenAt);
              return (
                <li key={photo.id} className="flex flex-col gap-1">
                  <div className="relative overflow-hidden rounded-xl bg-hf-black aspect-[3/4]">
                    <button
                      type="button"
                      onClick={() => chooseAfter(photo.id)}
                      aria-label={`${t("photoDiary.compare.chooseAsAfter")}, ${day}`}
                      className="block h-full w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" draggable={false} className="h-full w-full object-cover" />
                    </button>
                    <PhotoSelectBox
                      checked={selected}
                      number={2}
                      label={`${t("photoDiary.compare.chooseAsAfter")}, ${day}`}
                      onToggle={() => chooseAfter(photo.id)}
                    />
                  </div>
                  <p className="hf-type-caption truncate text-hf-white/70">{day}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === "compare" && after && (
        <>
          <div className="min-h-0 flex-1 px-4">
            <PhotoCompareSlider before={before} after={after} />
          </div>
          <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="grid w-full max-w-md grid-cols-2 gap-4">
              <SlotLabel number={1} label={t("photoDiary.compare.before")} date={formatPhotoDay(before.takenAt)} />
              <SlotLabel
                number={2}
                label={t("photoDiary.compare.after")}
                date={formatPhotoDay(after.takenAt)}
                alignEnd
              />
            </div>
            <button type="button" onClick={() => setPicking(true)} className="hf-btn-text min-h-11 text-hf-white">
              {t("photoDiary.compare.changeAfter")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SlotLabel({
  number,
  label,
  date,
  alignEnd,
}: {
  number: number;
  label: string;
  date?: string;
  alignEnd?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${alignEnd ? "justify-end" : ""}`}>
      <span
        aria-hidden
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-hf-white text-hf-black hf-type-body hf-type-strong"
      >
        {number}
      </span>
      <p className="hf-type-small min-w-0 truncate">
        <span className="hf-type-strong">{label}</span>
        {date ? ` · ${date}` : null}
      </p>
    </div>
  );
}
