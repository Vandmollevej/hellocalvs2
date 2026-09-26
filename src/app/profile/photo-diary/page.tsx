"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

type DiaryPhotoKind = "selfie" | "photo";

type DiaryPhoto = {
  id: string;
  dataUrl: string;
  takenAt: string;
  // Missing on entries saved before 2026-09-12 — treated as "photo" (the
  // original full-body/stomach grid) so existing local data keeps working.
  kind?: DiaryPhotoKind;
};

type DiaryUser = {
  photoDiaryRequiresPasscode: boolean;
};

type WeightEntryLite = {
  weightKg: number;
  weighedAt: string;
};

type BodyMeasurementLite = {
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  upperArmCm: number | null;
  neckCm: number | null;
  measuredAt: string;
};

// Item 2 (2026-09-02): billede-dagbog til at sammenligne fuld figur/mave over
// tid. Der findes endnu ingen billede-upload-/blob-infrastruktur i dette
// projekt (se docs/STATUS.md), så billederne gemmes for nu udelukkende
// client-side i localStorage — de ryger ikke i databasen og deles ikke
// mellem enheder. "Kræver telefonens adgangskode for at vise"-kontakten
// gemmes derimod i databasen (User.photoDiaryRequiresPasscode), men denne
// side håndhæver den IKKE med et rigtigt OS-lock endnu — det kræver en
// native app (Face ID/adgangskode-API) og er fremtidigt arbejde. Toggle'en
// er derfor kun den gemte brugerpræference i dag.
const STORAGE_KEY = "hello-cal:billede-dagbog";

function loadPhotos(): DiaryPhoto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiaryPhoto[];
    return parsed.map((photo) => ({ ...photo, kind: photo.kind ?? "photo" }));
  } catch {
    return [];
  }
}

function savePhotos(photos: DiaryPhoto[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  } catch {
    // Utilgængeligt lager (privat browsing e.l.) — ignorér.
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function isSameLocalDay(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// weightEntries/measurements come from the API already sorted newest-first
// (weighedAt/measuredAt desc), so the first match found here is always the
// most recent qualifying one.
function matchForDate<T>(
  photoTakenAt: string,
  entries: T[],
  dateOf: (entry: T) => string
): { entry: T; isSameDay: boolean } | null {
  const sameDay = entries.find((entry) => isSameLocalDay(dateOf(entry), photoTakenAt));
  if (sameDay) return { entry: sameDay, isSameDay: true };

  const photoTime = new Date(photoTakenAt).getTime();
  const before = entries.find((entry) => new Date(dateOf(entry)).getTime() <= photoTime);
  if (before) return { entry: before, isSameDay: false };

  return null;
}

function formatMeasurement(entry: BodyMeasurementLite, t: (key: string, params?: Record<string, string | number>) => string) {
  const parts: string[] = [];
  if (entry.neckCm != null) parts.push(t("photoDiary.measurementNeck", { value: entry.neckCm }));
  if (entry.waistCm != null) parts.push(t("photoDiary.measurementWaist", { value: entry.waistCm }));
  if (entry.hipCm != null) parts.push(t("photoDiary.measurementHip", { value: entry.hipCm }));
  if (entry.chestCm != null) parts.push(t("photoDiary.measurementChest", { value: entry.chestCm }));
  if (entry.thighCm != null) parts.push(t("photoDiary.measurementThigh", { value: entry.thighCm }));
  if (entry.upperArmCm != null) parts.push(t("photoDiary.measurementUpperArm", { value: entry.upperArmCm }));
  return parts.join(" · ");
}

export default function BilledeDagbogPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<DiaryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<DiaryPhoto[]>(() => loadPhotos());
  const [weightEntries, setWeightEntries] = useState<WeightEntryLite[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurementLite[]>([]);
  const [locked, setLocked] = useState(false);
  const [viewerSection, setViewerSection] = useState<DiaryPhotoKind | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setLocked(Boolean(data.user?.photoDiaryRequiresPasscode));
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Vægt/mål-billedtekst er kun til visning her — hentes bedst-effort og
  // fejler stille (fx uden database-forbindelse), da den ikke må blokere
  // selve billeddagbogen.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weight-entries")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setWeightEntries(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => {});
    fetch("/api/body-measurements")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMeasurements(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleRequiresPasscode(value: boolean) {
    setUser((current) => (current ? { ...current, photoDiaryRequiresPasscode: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDiaryRequiresPasscode: value }),
    }).catch(() => {});
  }

  function onFileSelected(kind: DiaryPhotoKind) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const next = [
          { id: crypto.randomUUID(), dataUrl: String(reader.result), takenAt: new Date().toISOString(), kind },
          ...photos,
        ];
        setPhotos(next);
        savePhotos(next);
      };
      reader.readAsDataURL(file);
    };
  }

  function remove(id: string) {
    const next = photos.filter((photo) => photo.id !== id);
    setPhotos(next);
    savePhotos(next);
  }

  const selfies = photos.filter((photo) => photo.kind === "selfie");
  const regularPhotos = photos.filter((photo) => photo.kind !== "selfie");
  const viewerPhotos = viewerSection === "selfie" ? selfies : regularPhotos;

  function openViewer(section: DiaryPhotoKind, index: number) {
    setViewerSection(section);
    setViewerIndex(index);
  }

  function closeViewer() {
    setViewerSection(null);
    setViewerIndex(null);
  }

  function onViewerDelete(id: string) {
    remove(id);
    setViewerIndex((current) => {
      if (current === null) return current;
      const remaining = viewerPhotos.length - 1;
      if (remaining <= 0) return null;
      return Math.min(current, remaining - 1);
    });
  }

  return (
    <HfScreen
      title={t("photoDiary.title")}
    >

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("photoDiary.loading") : t("photoDiary.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <Toggle
            label={t("photoDiary.requiresPasscode")}
            description={t("photoDiary.requiresPasscodeDescription")}
            checked={user.photoDiaryRequiresPasscode}
            onChange={toggleRequiresPasscode}
          />

          {locked && user.photoDiaryRequiresPasscode ? (
            <button
              type="button"
              onClick={() => setLocked(false)}
              className="hf-btn-primary w-full py-3.5 text-[15px]"
            >
              {t("photoDiary.showPhotos")}
            </button>
          ) : (
            <>
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={onFileSelected("selfie")}
              />
              <button
                type="button"
                onClick={() => selfieInputRef.current?.click()}
                className="hf-btn-primary w-full py-3.5 text-[15px]"
              >
                {t("photoDiary.takeSelfie")}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onFileSelected("photo")}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hf-btn-secondary w-full py-3.5 text-[15px]"
              >
                {t("photoDiary.takePhoto")}
              </button>

              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold text-hf-black">
                  {t("photoDiary.selfiesSectionTitle")}
                </h2>
                {selfies.length === 0 ? (
                  <p className="text-center text-[13px] text-hf-black opacity-60">
                    {t("photoDiary.noSelfiesYet")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {selfies.map((photo, index) => (
                      <div key={photo.id} className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => openViewer("selfie", index)}
                          className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-hf-tan text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.dataUrl}
                            alt={t("photoDiary.photoAlt")}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                            {formatDate(photo.takenAt)}
                          </span>
                        </button>
                        <div className="flex flex-col gap-0.5 px-1 text-[13px] text-hf-black">
                          <WeightCaptionLine photo={photo} weightEntries={weightEntries} t={t} />
                          <MeasurementCaptionLine photo={photo} measurements={measurements} t={t} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold text-hf-black">
                  {t("photoDiary.photosSectionTitle")}
                </h2>
                {regularPhotos.length === 0 ? (
                  <p className="text-center text-[13px] text-hf-black opacity-60">
                    {t("photoDiary.noPhotosYet")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {regularPhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => openViewer("photo", index)}
                        className="relative overflow-hidden rounded-2xl bg-hf-tan text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.dataUrl}
                          alt={t("photoDiary.photoAlt")}
                          className="h-40 w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                          {formatDate(photo.takenAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {viewerSection !== null && viewerIndex !== null && viewerPhotos[viewerIndex] && (
        <PhotoViewer
          photos={viewerPhotos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={closeViewer}
          onDelete={onViewerDelete}
          t={t}
        />
      )}
    </HfScreen>
  );
}

// Under selfien: hvis der er logget vægt samme kalenderdag som billedet,
// vises "Aktuel vægt"; ellers den seneste vejning før billedet som
// "Seneste vægt". Mål-linjen (WeightCaptionLine's søster nedenfor) følger
// samme regel for kropsmål.
function WeightCaptionLine({
  photo,
  weightEntries,
  t,
}: {
  photo: DiaryPhoto;
  weightEntries: WeightEntryLite[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const match = matchForDate(photo.takenAt, weightEntries, (entry) => entry.weighedAt);
  if (!match) return <p className="opacity-60">{t("photoDiary.noWeight")}</p>;
  return (
    <p>
      {match.isSameDay
        ? t("photoDiary.currentWeight", { value: match.entry.weightKg })
        : t("photoDiary.latestWeight", {
            value: match.entry.weightKg,
            date: formatDateShort(match.entry.weighedAt),
          })}
    </p>
  );
}

function MeasurementCaptionLine({
  photo,
  measurements,
  t,
}: {
  photo: DiaryPhoto;
  measurements: BodyMeasurementLite[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const match = matchForDate(photo.takenAt, measurements, (entry) => entry.measuredAt);
  if (!match) return <p className="opacity-60">{t("photoDiary.noMeasurements")}</p>;
  const value = formatMeasurement(match.entry, t);
  return (
    <p className="opacity-70">
      {match.isSameDay
        ? t("photoDiary.currentMeasurements", { value })
        : t("photoDiary.latestMeasurements", { value, date: formatDateShort(match.entry.measuredAt) })}
    </p>
  );
}

// Fejlretninger/FEJLLISTE.md #21: fuld-højde portræt-visning med swipe frem/
// tilbage og dato under billedet, i stedet for kun det faste 2-kolonne-grid.
function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onDelete,
  t,
}: {
  photos: DiaryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const startX = useRef<number | null>(null);
  const photo = photos[index];

  function handlePointerDown(event: React.PointerEvent) {
    startX.current = event.clientX;
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    const SWIPE_THRESHOLD = 50;
    if (delta < -SWIPE_THRESHOLD && index < photos.length - 1) onIndexChange(index + 1);
    else if (delta > SWIPE_THRESHOLD && index > 0) onIndexChange(index - 1);
  }

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="text-white">
          <IconX size={24} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          aria-label={t("photoDiary.deleteAria")}
          className="text-white"
        >
          <IconTrash size={20} />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            aria-label={t("photoDiary.previousPhoto")}
            className="absolute left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          >
            <IconChevronLeft size={20} />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.dataUrl}
          alt={t("photoDiary.photoAlt")}
          className="h-full w-full object-contain"
        />
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            aria-label={t("photoDiary.nextPhoto")}
            className="absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          >
            <IconChevronRight size={20} />
          </button>
        )}
      </div>

      <p className="px-4 py-4 text-center text-[13px] text-white/80">{formatDate(photo.takenAt)}</p>
    </div>
  );
}
