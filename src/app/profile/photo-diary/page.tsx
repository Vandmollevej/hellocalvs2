"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { confirmOnDevice, isPasskeySupported } from "@/lib/passkey-client";
import {
  addDiaryPhoto,
  deleteDiaryPhoto,
  listDiaryPhotos,
  migrateLegacyDiaryPhotos,
  prepareDiaryPhoto,
  type StoredDiaryPhoto,
} from "@/lib/photo-diary-store";

type DiaryPhoto = {
  id: string;
  /** Object URL for the stored Blob — revoked when the photo leaves the page. */
  url: string;
  takenAt: string;
};

type DiaryUser = {
  photoDiaryRequiresPasscode: boolean;
};

// Item 2 (2026-09-02): billede-dagbog til at sammenligne fuld figur/mave over
// tid. Billederne gemmes kun på enheden (IndexedDB, se
// src/lib/photo-diary-store.ts) — de ryger ikke i databasen og deles ikke
// mellem enheder. "Kræver telefonens adgangskode for at vise"-kontakten
// gemmes i databasen (User.photoDiaryRequiresPasscode). Er den slået til,
// vises billederne først efter Face ID/Touch ID/telefonens kode (WebAuthn,
// se confirmOnDevice), og siden låser igen, når den går i baggrunden — så
// billederne ikke vises ved et uheld, fx i bussen. Det er en visningslås,
// ikke kryptering.

// Kameraet åbnet fra "Tag billede" kan få siden til at gå i baggrunden. Det
// må ikke låse siden, ellers ligger det nye billede skjult bag låsen, så det
// ligner, at det forsvandt.
const CAMERA_HIDE_GRACE_MS = 3000;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toView(photo: StoredDiaryPhoto, urls: Set<string>): DiaryPhoto {
  const url = URL.createObjectURL(photo.blob);
  urls.add(url);
  return { id: photo.id, takenAt: photo.takenAt, url };
}

export default function BilledeDagbogPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<DiaryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<DiaryPhoto[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<"load" | "save" | "delete" | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraOpenedAt = useRef(0);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    let cancelled = false;
    migrateLegacyDiaryPhotos()
      .catch(() => {})
      .then(() => listDiaryPhotos())
      .then((stored) => {
        if (!cancelled) setPhotos(stored.map((photo) => toView(photo, urls)));
      })
      .catch(() => {
        if (!cancelled) setStorageError("load");
      })
      .finally(() => {
        if (!cancelled) setPhotosLoaded(true);
      });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

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

  // Lås igen, når appen/fanen forlades, så billederne ikke står fremme
  // næste gang telefonen tages op.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (Date.now() - cameraOpenedAt.current < CAMERA_HIDE_GRACE_MS) return;
      setLocked(true);
      setViewerIndex(null);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function unlock(): Promise<boolean> {
    setUnlockError(false);
    // Uden WebAuthn-understøttelse (fx ældre browser) er låsen blot et ekstra
    // tryk, så billederne stadig ikke vises med det samme.
    if (!isPasskeySupported()) {
      setLocked(false);
      return true;
    }
    setUnlocking(true);
    try {
      await confirmOnDevice();
      setLocked(false);
      return true;
    } catch {
      setUnlockError(true);
      return false;
    } finally {
      setUnlocking(false);
    }
  }

  async function toggleRequiresPasscode(value: boolean) {
    // Låsen må ikke kunne slås fra uden bekræftelse, mens billederne er låst.
    if (!value && locked && !(await unlock())) return;
    setUser((current) => (current ? { ...current, photoDiaryRequiresPasscode: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDiaryRequiresPasscode: value }),
    }).catch(() => {});
  }

  function openCamera() {
    cameraOpenedAt.current = Date.now();
    fileInputRef.current?.click();
  }

  // Billedet vises først, når det er gemt — slår gemningen fejl, siges det
  // højt i stedet for at vise et billede, der forsvinder igen.
  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSaving(true);
    setStorageError(null);
    try {
      const photo = {
        id: crypto.randomUUID(),
        takenAt: new Date().toISOString(),
        blob: await prepareDiaryPhoto(file),
      };
      await addDiaryPhoto(photo);
      const view = toView(photo, objectUrls.current);
      setPhotos((current) => [view, ...current]);
    } catch {
      setStorageError("save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<boolean> {
    setStorageError(null);
    try {
      await deleteDiaryPhoto(id);
    } catch {
      setStorageError("delete");
      return false;
    }
    const photo = photos.find((entry) => entry.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.url);
      objectUrls.current.delete(photo.url);
    }
    setPhotos((current) => current.filter((entry) => entry.id !== id));
    return true;
  }

  async function onViewerDelete(id: string) {
    const remaining = photos.length - 1;
    if (!(await remove(id))) return;
    setViewerIndex((current) => {
      if (current === null) return current;
      if (remaining <= 0) return null;
      return Math.min(current, remaining - 1);
    });
  }

  return (
    <HfScreen
      title={t("photoDiary.title")}
    >

      {loading || !user ? (
        <p className="p-4 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("photoDiary.loading") : t("photoDiary.loadError")}
        </p>
      ) : (
        <div className="hf-page">
          <Toggle
            label={t("photoDiary.requiresPasscode")}
            description={t("photoDiary.requiresPasscodeDescription")}
            checked={user.photoDiaryRequiresPasscode}
            onChange={toggleRequiresPasscode}
          />

          {locked && user.photoDiaryRequiresPasscode ? (
            <>
              <button
                type="button"
                onClick={unlock}
                disabled={unlocking}
                className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-40"
              >
                {unlocking ? t("photoDiary.unlocking") : t("photoDiary.showPhotos")}
              </button>
              {unlockError && (
                <p className="text-center text-[13px] text-hf-red-dark">{t("photoDiary.unlockError")}</p>
              )}
            </>
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
                onClick={openCamera}
                disabled={saving}
                className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-40"
              >
                {saving ? t("photoDiary.saving") : t("photoDiary.takePhoto")}
              </button>
              {storageError && (
                <p className="text-center text-[13px] text-hf-red-dark">
                  {t(
                    storageError === "load"
                      ? "photoDiary.storageLoadError"
                      : storageError === "save"
                        ? "photoDiary.saveError"
                        : "photoDiary.deleteError"
                  )}
                </p>
              )}

              <section className="flex flex-col gap-4">
                {!photosLoaded ? null : photos.length === 0 ? (
                  <p className="text-center text-[13px] text-hf-black opacity-60">
                    {t("photoDiary.noPhotosYet")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setViewerIndex(index)}
                        className="relative overflow-hidden rounded-2xl bg-hf-tan text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
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

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDelete={onViewerDelete}
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
          src={photo.url}
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
