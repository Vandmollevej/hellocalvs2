"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import { useAutoCapture } from "@/components/camera/useAutoCapture";
import { cameraVideoConstraints, captureStill, captureStillWithFull } from "@/lib/camera-still";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kameraet I opdater-banneret (brugerens regel 2026-10-15): trækkes banneret
// ned, står søgeren direkte i dropdownen — som Tilføj-kameraet (kvadrat,
// automatisk udløsning, udløser nederst i billedet), aldrig en ny side og
// aldrig en "Tag billede"-knap. Fotoet læses med det samme
// (POST /api/products/[id]/update, ulæseligt indhold via /ingredients-photo).

export type UpdateKind = "FRONT" | "NUTRITION" | "INGREDIENTS";
export type UpdateCameraTile = { kind: UpdateKind; label: string; retake?: boolean };

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type Outcome = "done" | "unreadable" | "error";

const HINT_KEYS = {
  FRONT: "cameraCreate.hintFront",
  NUTRITION: "cameraCreate.hintNutrition",
  INGREDIENTS: "cameraCreate.hintIngredients",
} as const;
// Så længe står "Tak!" i dropdownen, før varen hentes igen.
const DONE_PAUSE_MS = 2500;

function statusFromCameraError(error: unknown): CameraStatus {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  return "error";
}

export function UpdateCameraPanel({
  productId,
  tiles,
  active,
  onUpdated,
}: {
  productId: string;
  tiles: UpdateCameraTile[];
  /** Kameraet kører kun, mens dropdownen er trukket ned. */
  active: boolean;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);
  const [selected, setSelected] = useState<UpdateKind>(tiles[0]?.kind ?? "FRONT");
  const [outcomes, setOutcomes] = useState<Partial<Record<UpdateKind, Outcome>>>({});
  const [earned, setEarned] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const tile = tiles.find((item) => item.kind === selected) ?? tiles[0];
  const allDone = tiles.length > 0 && tiles.every((item) => outcomes[item.kind] === "done");
  const cameraOn = active && !allDone;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    async function start() {
      setCameraStatus("starting");
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraVideoConstraints() });
        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (!cancelled) setCameraStatus("active");
      } catch (error) {
        if (!cancelled) setCameraStatus(statusFromCameraError(error));
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOn, restartKey, stopCamera]);

  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(onUpdated, DONE_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [allDone, onUpdated]);

  async function capturePhoto() {
    if (!tile || working || capturingRef.current || cameraStatus !== "active") return;
    capturingRef.current = true;
    setWorking(true);
    const kind = tile.kind;
    let body: Record<string, unknown> | null = null;
    if (kind === "FRONT") {
      // Forsiden gemmes som søgerens kvadrat i fuld opløsning (DECISIONS 2026-10-15).
      const pair = await captureStillWithFull(videoRef.current, "square", "square");
      if (pair) body = { kind, photo: pair.still.url, fullPhoto: pair.full.url };
    } else {
      const still = await captureStill(videoRef.current, "square");
      if (still) body = { kind, photo: still.url };
    }
    capturingRef.current = false;
    if (!body) {
      setWorking(false);
      return;
    }
    setPhoto(body.photo as string);
    let outcome: Outcome = "error";
    try {
      const response = tile.retake
        ? await fetch(`/api/products/${encodeURIComponent(productId)}/ingredients-photo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo: body.photo }),
          })
        : await fetch(`/api/products/${encodeURIComponent(productId)}/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, photoTakenAt: Date.now() }),
          });
      if (response.ok) {
        const data = (await response.json()) as { accepted?: boolean; ingredientsFound?: boolean; pointsAwarded?: number };
        outcome = (tile.retake ? data.ingredientsFound : data.accepted) ? "done" : "unreadable";
        if (data.pointsAwarded) setEarned((current) => current + data.pointsAwarded!);
      }
    } catch {
      outcome = "error";
    }
    const nextOutcomes = { ...outcomes, [kind]: outcome };
    setOutcomes(nextOutcomes);
    if (outcome === "done") {
      const next = tiles.find((item) => nextOutcomes[item.kind] !== "done");
      if (next) setSelected(next.kind);
    }
    setPhoto(null);
    setWorking(false);
  }

  const capturePhotoRef = useRef(capturePhoto);
  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  });

  const outcome = tile ? outcomes[tile.kind] : undefined;
  // Efter et ulæseligt foto venter kameraet på et tryk, så det ikke tager det
  // samme uskarpe billede igen og igen.
  const autoCaptureProgress = useAutoCapture(
    videoRef,
    cameraOn && cameraStatus === "active" && !working && !photo && outcome !== "unreadable" && outcome !== "error",
    () => void capturePhotoRef.current(),
  );

  if (!tile) return null;

  const cameraMessage =
    cameraStatus === "starting"
      ? t("camera.starting")
      : cameraStatus === "denied"
        ? t("camera.deniedAccess")
        : cameraStatus === "unavailable"
          ? t("camera.unavailable")
          : cameraStatus === "error"
            ? t("camera.error")
            : null;

  const caption = allDone
    ? earned > 0
      ? t("productUpdate.earned", { points: earned })
      : t("productUpdate.done")
    : outcome === "unreadable"
      ? t("productUpdate.unreadable")
      : outcome === "error"
        ? t("productUpdate.error")
        : t(HINT_KEYS[tile.kind]);

  return (
    <div className="flex flex-col gap-3 px-4 pt-3">
      {!allDone && (
        <div className="hf-camera-preview" onClick={() => void capturePhoto()}>
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            aria-label={t("camera.liveViewAriaLabel")}
          />
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- lokalt data-URL-foto
            <img src={photo} alt={t("camera.photoAlt")} className="absolute inset-0 h-full w-full object-cover" />
          )}
          {!photo && (
            <div
              className="pointer-events-none absolute inset-[12%] border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.2)] transition-colors rounded-card"
              style={{ borderColor: autoCaptureProgress > 0 ? "var(--hf-color-brand)" : "rgba(255,255,255,0.8)" }}
            >
              <div
                className="absolute bottom-0 left-0 h-1 rounded-full bg-hf-green transition-[width]"
                style={{ width: `${autoCaptureProgress * 100}%` }}
              />
            </div>
          )}
          {cameraStatus === "active" && !working && !photo && (
            <div className="absolute inset-x-3 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void capturePhoto();
                }}
                aria-label={t("cameraCreate.shutter")}
                className="hf-shutter"
              >
                <span className="hf-shutter__inner" />
              </button>
            </div>
          )}
          {cameraMessage && (
            <div
              className="hf-camera-overlay"
              onClick={
                cameraStatus === "denied" || cameraStatus === "error"
                  ? (event) => {
                      event.stopPropagation();
                      setRestartKey((key) => key + 1);
                    }
                  : undefined
              }
            >
              <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{cameraMessage}</p>
            </div>
          )}
          {working && <PhotoWorkingOverlay label={t("cameraCreate.analyzingDefault")} />}
        </div>
      )}
      <p className={`text-center ${allDone ? "hf-type-body hf-type-strong text-hf-black" : "hf-type-caption"}`} aria-live="polite">
        {caption}
      </p>
      {tiles.length > 1 && !allDone && (
        <div className="flex justify-center gap-2">
          {tiles.map((item) => {
            const done = outcomes[item.kind] === "done";
            const current = item.kind === tile.kind;
            return (
              <button
                key={item.kind}
                type="button"
                disabled={working || done}
                aria-pressed={current}
                onClick={() => setSelected(item.kind)}
                className={`hf-type-small flex h-9 items-center gap-1 rounded-full px-4 ${
                  current ? "bg-hf-black text-hf-white" : "bg-hf-cream text-hf-black"
                }`}
              >
                {done && <IconCheck size={16} aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
