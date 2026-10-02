"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  comparePercentAt,
  daysBetweenPhotos,
  fitContain,
  formatPhotoDay,
  type DiaryPhoto,
} from "@/lib/photo-diary";

type Mode = "wipe" | "fade";
type Slot = "before" | "after";

const KEY_STEP = 5;

// Før/efter-sammenligning i billede-dagbogen: to billeder lagt oven i
// hinanden. "Glid" viser "før" til venstre for en skillelinje, der trækkes
// frem og tilbage, og "efter" til højre. "Ton" lægger "efter" over "før" med
// en gennemsigtighed, der følger fingeren. Begge billeder fylder samme boks
// (formet efter "før"-billedet), så kroppen står samme sted i begge.
export function PhotoCompare({
  photos,
  initialBeforeId,
  initialAfterId,
  onClose,
}: {
  // Ældste først.
  photos: DiaryPhoto[];
  initialBeforeId: string;
  initialAfterId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [beforeId, setBeforeId] = useState(initialBeforeId);
  const [afterId, setAfterId] = useState(initialAfterId);
  const [mode, setMode] = useState<Mode>("wipe");
  const [percent, setPercent] = useState(50);
  const [slot, setSlot] = useState<Slot>("after");
  const [ratio, setRatio] = useState(3 / 4);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const areaRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragPointer = useRef<number | null>(null);

  const before = photos.find((photo) => photo.id === beforeId) ?? photos[0];
  const after = photos.find((photo) => photo.id === afterId) ?? photos[photos.length - 1];
  const box = fitContain(ratio, area.width, area.height);
  const days = before && after ? daysBetweenPhotos(before.takenAt, after.takenAt) : 0;

  useLayoutEffect(() => {
    const element = areaRef.current;
    if (!element) return;
    const measure = () => setArea({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function moveTo(clientX: number) {
    const rect = boxRef.current?.getBoundingClientRect();
    if (rect) setPercent(comparePercentAt(clientX, rect.left, rect.width));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragPointer.current === event.pointerId) moveTo(event.clientX);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragPointer.current !== event.pointerId) return;
    dragPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleSliderKey(event: React.KeyboardEvent) {
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? percent - KEY_STEP
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? percent + KEY_STEP
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 100
              : null;
    if (next === null) return;
    event.preventDefault();
    setPercent(Math.min(100, Math.max(0, next)));
  }

  // Et tryk på et miniaturebillede lægger det på den valgte plads. Står det
  // allerede på den anden plads, bytter de to plads.
  function assign(id: string) {
    if (slot === "before") {
      if (id === afterId) setAfterId(beforeId);
      setBeforeId(id);
    } else {
      if (id === beforeId) setBeforeId(afterId);
      setAfterId(id);
    }
  }

  function swap() {
    setBeforeId(afterId);
    setAfterId(beforeId);
  }

  if (!before || !after) return null;

  const sliderLabel = t(mode === "wipe" ? "photoDiary.compare.wipeSlider" : "photoDiary.compare.fadeSlider");
  const sliderProps = {
    role: "slider",
    tabIndex: 0,
    "aria-label": sliderLabel,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.round(percent),
    "aria-valuetext": `${Math.round(percent)} %`,
    onKeyDown: handleSliderKey,
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("photoDiary.compare.title")}
      className="fixed inset-0 z-50 flex flex-col bg-hf-black"
    >
      <div className="grid grid-cols-[44px_1fr_44px] items-center px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="hf-btn-icon text-hf-white">
          <IconX size={24} />
        </button>
        <p className="hf-type-card-title text-center text-hf-white">{t("photoDiary.compare.title")}</p>
        <span />
      </div>

      <div ref={areaRef} className="relative mx-4 min-h-0 flex-1">
        <div
          ref={boxRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none select-none overflow-hidden rounded-2xl"
          style={{ width: box.width, height: box.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={before.url}
            alt={t("photoDiary.compare.beforeAlt", { date: formatPhotoDay(before.takenAt) })}
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) setRatio(naturalWidth / naturalHeight);
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={after.url}
            alt={t("photoDiary.compare.afterAlt", { date: formatPhotoDay(after.takenAt) })}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={
              mode === "wipe"
                ? { clipPath: `inset(0 0 0 ${percent}%)` }
                : { opacity: percent / 100 }
            }
          />

          <span className="hf-type-caption absolute left-2 top-2 max-w-[calc(50%-12px)] truncate rounded-full bg-hf-black/55 px-2.5 py-1 text-hf-white">
            {t("photoDiary.compare.before")} · {formatPhotoDay(before.takenAt)}
          </span>
          <span className="hf-type-caption absolute right-2 top-2 max-w-[calc(50%-12px)] truncate rounded-full bg-hf-black/55 px-2.5 py-1 text-hf-white">
            {t("photoDiary.compare.after")} · {formatPhotoDay(after.takenAt)}
          </span>

          {mode === "wipe" && (
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-hf-white"
              style={{ left: `${percent}%` }}
            >
              <div
                {...sliderProps}
                className="pointer-events-auto absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-hf-white text-hf-black shadow-md outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
              >
                <IconChevronLeft size={16} />
                <IconChevronRight size={16} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        {mode === "fade" && (
          <div
            {...sliderProps}
            className="relative flex h-5 touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
            onPointerDown={(event) => {
              dragPointer.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              setPercent(comparePercentAt(event.clientX, rect.left, rect.width));
            }}
            onPointerMove={(event) => {
              if (dragPointer.current !== event.pointerId) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setPercent(comparePercentAt(event.clientX, rect.left, rect.width));
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="relative h-1 w-full rounded bg-hf-white/30">
              <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${percent}%` }} />
            </div>
            <div
              className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white"
              style={{ left: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="hf-type-small text-hf-white/70">
            {days === 0
              ? t("photoDiary.compare.sameDay")
              : days === 1
                ? t("photoDiary.compare.oneDayApart")
                : t("photoDiary.compare.daysApart", { count: days })}
          </p>
          <div className="flex gap-2" role="group" aria-label={t("photoDiary.compare.modeLabel")}>
            <button type="button" className="hf-choice" aria-pressed={mode === "wipe"} onClick={() => setMode("wipe")}>
              {t("photoDiary.compare.modeWipe")}
            </button>
            <button type="button" className="hf-choice" aria-pressed={mode === "fade"} onClick={() => setMode("fade")}>
              {t("photoDiary.compare.modeFade")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-2" role="group" aria-label={t("photoDiary.compare.pickLabel")}>
            <button type="button" className="hf-choice" aria-pressed={slot === "before"} onClick={() => setSlot("before")}>
              {t("photoDiary.compare.before")}
            </button>
            <button type="button" className="hf-choice" aria-pressed={slot === "after"} onClick={() => setSlot("after")}>
              {t("photoDiary.compare.after")}
            </button>
          </div>
          <button type="button" onClick={swap} className="hf-btn-text ml-auto text-hf-white">
            {t("photoDiary.compare.swap")}
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {photos.map((photo) => {
            const isBefore = photo.id === before.id;
            const isAfter = photo.id === after.id;
            const isTarget = slot === "before" ? isBefore : isAfter;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => assign(photo.id)}
                aria-label={t("photoDiary.compare.pickPhoto", { date: formatPhotoDay(photo.takenAt) })}
                aria-pressed={isTarget}
                className={`relative h-20 w-14 shrink-0 overflow-hidden rounded-lg ${
                  isTarget ? "ring-2 ring-hf-green" : isBefore || isAfter ? "ring-1 ring-hf-white/60" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" draggable={false} className="h-full w-full object-cover" />
                {(isBefore || isAfter) && (
                  <span className="hf-type-caption absolute inset-x-0 bottom-0 bg-hf-black/55 text-center text-hf-white">
                    {t(isBefore ? "photoDiary.compare.before" : "photoDiary.compare.after")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
