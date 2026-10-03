"use client";

import { useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatPhotoDay, type DiaryPhoto } from "@/lib/photo-diary";
import {
  COMPARE_FALLBACK_RATIO,
  COMPARE_START_PERCENT,
  compareRatio,
  percentFromKey,
  percentFromPointer,
} from "@/lib/photo-compare";

// To billeder lagt oven på hinanden med en lodret skyder imellem: til venstre
// for skyderen ses før-billedet (1), til højre efter-billedet (2). Træk hvor
// som helst i billedet — med finger eller mus — eller brug piletasterne på
// håndtaget. Feltet får før-billedets format og fylder så meget af den
// ledige plads som muligt; efter-billedet beskæres til samme felt.
export function PhotoCompareSlider({ before, after }: { before: DiaryPhoto; after: DiaryPhoto }) {
  const { t } = useTranslation();
  const [percent, setPercent] = useState(COMPARE_START_PERCENT);
  const [ratio, setRatio] = useState(COMPARE_FALLBACK_RATIO);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<number | null>(null);

  function moveTo(clientX: number) {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setPercent(percentFromPointer(clientX, rect.left, rect.width));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    draggingRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingRef.current !== event.pointerId) return;
    moveTo(event.clientX);
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingRef.current !== event.pointerId) return;
    draggingRef.current = null;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const next = percentFromKey(percent, event.key);
    if (next === null) return;
    event.preventDefault();
    setPercent(next);
  }

  return (
    <div className="relative h-full w-full [container-type:size]">
      <div
        ref={boxRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none select-none overflow-hidden rounded-2xl bg-hf-black [-webkit-touch-callout:none]"
        style={{ width: `min(100cqw, ${ratio} * 100cqh)`, aspectRatio: ratio }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after.url}
          alt={`${t("photoDiary.compare.after")}, ${formatPhotoDay(after.takenAt)}`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before.url}
          alt={`${t("photoDiary.compare.before")}, ${formatPhotoDay(before.takenAt)}`}
          draggable={false}
          onLoad={(event) =>
            setRatio(compareRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))
          }
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        />

        <span className="hf-type-caption pointer-events-none absolute left-2 top-2 rounded-full bg-hf-black/40 px-2 py-1 text-hf-white">
          1 · {t("photoDiary.compare.before")}
        </span>
        <span className="hf-type-caption pointer-events-none absolute right-2 top-2 rounded-full bg-hf-black/40 px-2 py-1 text-hf-white">
          2 · {t("photoDiary.compare.after")}
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-hf-white shadow-md"
          style={{ left: `${percent}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label={t("photoDiary.compare.sliderAria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-valuetext={`${Math.round(percent)} %`}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-hf-white text-hf-black shadow-md"
          style={{ left: `${percent}%` }}
        >
          <IconChevronLeft size={16} stroke={2.5} />
          <IconChevronRight size={16} stroke={2.5} />
        </div>
      </div>
    </div>
  );
}
