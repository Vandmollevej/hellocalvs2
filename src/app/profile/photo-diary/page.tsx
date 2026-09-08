"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

type DiaryPhoto = {
  id: string;
  dataUrl: string;
  takenAt: string;
};

type DiaryUser = {
  photoDiaryRequiresPasscode: boolean;
};

// Item 2 (2026-09-02): billede-dagbog til at sammenligne fuld figur/mave over
// tid. Der findes endnu ingen billed-upload-/blob-infrastruktur i dette
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
    return raw ? (JSON.parse(raw) as DiaryPhoto[]) : [];
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

export default function BilledeDagbogPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<DiaryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<DiaryPhoto[]>(() => loadPhotos());
  const [locked, setLocked] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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

  function toggleRequiresPasscode(value: boolean) {
    setUser((current) => (current ? { ...current, photoDiaryRequiresPasscode: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDiaryRequiresPasscode: value }),
    }).catch(() => {});
  }

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = [
        { id: crypto.randomUUID(), dataUrl: String(reader.result), takenAt: new Date().toISOString() },
        ...photos,
      ];
      setPhotos(next);
      savePhotos(next);
    };
    reader.readAsDataURL(file);
  }

  function remove(id: string) {
    const next = photos.filter((photo) => photo.id !== id);
    setPhotos(next);
    savePhotos(next);
  }

  return (
    <HfScreen
      title={t("photoDiary.title")}
      onBack={() => router.back()}
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
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onFileSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hf-btn-primary w-full py-3.5 text-[15px]"
              >
                {t("photoDiary.takePhoto")}
              </button>

              {photos.length === 0 ? (
                <p className="text-center text-[13px] text-hf-black opacity-60">
                  {t("photoDiary.noPhotosYet")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setViewerIndex(index)}
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
            </>
          )}
        </div>
      )}

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={(id) => {
            remove(id);
            setViewerIndex((current) => {
              if (current === null) return current;
              const remaining = photos.length - 1;
              if (remaining <= 0) return null;
              return Math.min(current, remaining - 1);
            });
          }}
          t={t}
        />
      )}
    </HfScreen>
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
