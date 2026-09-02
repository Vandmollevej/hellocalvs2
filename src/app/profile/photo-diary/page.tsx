"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { Toggle } from "@/components/ui/Toggle";

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
  const router = useRouter();
  const [user, setUser] = useState<DiaryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<DiaryPhoto[]>(() => loadPhotos());
  const [locked, setLocked] = useState(false);
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
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Billede-dagbog" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente billede-dagbog."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <Toggle
            label="Kræver telefonens adgangskode for at vise"
            description="Håndhæves endnu ikke af OS'et — det kræver en native app. Kun en gemt præference i dag."
            checked={user.photoDiaryRequiresPasscode}
            onChange={toggleRequiresPasscode}
          />

          {locked && user.photoDiaryRequiresPasscode ? (
            <button
              type="button"
              onClick={() => setLocked(false)}
              className="hf-btn-primary w-full py-3.5 text-[15px]"
            >
              Vis billeder (ingen rigtig adgangskode-kontrol endnu)
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
                Tag billede (fuld figur eller mave)
              </button>

              {photos.length === 0 ? (
                <p className="text-center text-[13px] text-hf-black opacity-60">
                  Ingen billeder endnu — tag det første for at kunne sammenligne senere.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden rounded-2xl bg-hf-tan">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.dataUrl}
                        alt="Billede-dagbog-optagelse"
                        className="h-40 w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                        {formatDate(photo.takenAt)}
                      </span>
                      <button
                        type="button"
                        aria-label="Slet billede"
                        onClick={() => remove(photo.id)}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
