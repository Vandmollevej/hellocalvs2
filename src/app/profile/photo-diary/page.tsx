"use client";

import { useEffect, useRef, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { PhotoCarousel } from "@/components/photo-diary/PhotoCarousel";
import { PhotoViewer } from "@/components/photo-diary/PhotoViewer";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { confirmOnDevice, isPasskeySupported } from "@/lib/passkey-client";
import { sortOldestFirst, wrapIndex, type DiaryPhoto } from "@/lib/photo-diary";
import {
  addDiaryPhoto,
  deleteDiaryPhoto,
  listDiaryPhotos,
  migrateLegacyDiaryPhotos,
  prepareDiaryPhoto,
  type StoredDiaryPhoto,
} from "@/lib/photo-diary-store";

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
  // Billedet i karrusellens midte (og i fuldskærm). null = det nyeste.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraOpenedAt = useRef(0);
  const objectUrls = useRef(new Set<string>());

  const ordered = sortOldestFirst(photos);
  const activeIndex = Math.max(
    0,
    activeId ? ordered.findIndex((photo) => photo.id === activeId) : ordered.length - 1
  );

  useEffect(() => {
    const urls = objectUrls.current;
    let cancelled = false;
    let migrationFailed = false;
    migrateLegacyDiaryPhotos()
      .catch(() => {
        // De gamle billeder bliver liggende i localStorage til næste forsøg.
        migrationFailed = true;
      })
      .then(() => listDiaryPhotos())
      .then((stored) => {
        if (cancelled) return;
        setPhotos(stored.map((photo) => toView(photo, urls)));
        if (migrationFailed) setStorageError("load");
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
      setViewerOpen(false);
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
      // Et nyt billede er det nyeste og står derfor i midten.
      setActiveId(null);
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

  function selectIndex(index: number) {
    setActiveId(ordered[index]?.id ?? null);
  }

  function openViewer(index: number) {
    selectIndex(index);
    setViewerOpen(true);
  }

  async function onViewerDelete(id: string) {
    const deletedIndex = ordered.findIndex((photo) => photo.id === id);
    const remaining = ordered.filter((photo) => photo.id !== id);
    if (!(await remove(id))) return;
    if (remaining.length === 0) {
      setActiveId(null);
      setViewerOpen(false);
      return;
    }
    // Vis det forrige (ældre) billede; slettes det ældste, fortsætter loopet
    // bagfra til det nyeste.
    setActiveId(remaining[wrapIndex(deletedIndex - 1, remaining.length)].id);
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

              {!photosLoaded ? null : ordered.length === 0 ? (
                <p className="text-center text-[13px] text-hf-black opacity-60">
                  {t("photoDiary.noPhotosYet")}
                </p>
              ) : (
                <PhotoCarousel
                  photos={ordered}
                  index={activeIndex}
                  onIndexChange={selectIndex}
                  onOpen={openViewer}
                />
              )}
            </>
          )}
        </div>
      )}

      {viewerOpen && ordered[activeIndex] && (
        <PhotoViewer
          photos={ordered}
          index={activeIndex}
          onIndexChange={selectIndex}
          onClose={() => setViewerOpen(false)}
          onDelete={onViewerDelete}
        />
      )}
    </HfScreen>
  );
}
