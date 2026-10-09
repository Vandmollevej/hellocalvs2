"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCamera } from "@tabler/icons-react";
import { PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import { cameraVideoConstraints, captureStill } from "@/lib/camera-still";
import { newScanFlowId, scanFlowHeaders, scanLog } from "@/lib/scan-debug-log";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useAutoCapture } from "./useAutoCapture";

// Nyt foto af ingredienslisten, når AI ikke kunne læse det første
// (docs/DECISIONS.md 2026-10-02). Åbnes fra varesiden; fotoet tages
// automatisk som i kameraflowet og læses af OpenAI med det samme.

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type Result = "idle" | "unreadable" | "failed";

function statusFromCameraError(error: unknown): CameraStatus {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  return "error";
}

export function IngredientsRetakeFlow({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const leavingRef = useRef(false);
  const capturingRef = useRef(false);
  const [flowId] = useState(newScanFlowId);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result>("idle");
  const productHref = `/add/${encodeURIComponent(productId)}`;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraVideoConstraints() });
        if (cancelled) {
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
  }, [restartKey, stopCamera]);

  async function capturePhoto() {
    if (working || capturingRef.current) return;
    capturingRef.current = true;
    setWorking(true);
    setResult("idle");
    const startedAt = Date.now();
    const frame = await captureStill(videoRef.current, "square");
    capturingRef.current = false;
    if (leavingRef.current) return;
    if (!frame) {
      setWorking(false);
      return;
    }
    setPhoto(frame.url);
    scanLog(flowId, "photo_captured", {
      message: `Nyt indholdsfoto: ${frame.source === "photo" ? "stillbillede" : "videobillede"} ${frame.width}×${frame.height}, skarphed ${frame.sharpness}`,
      productId,
      durationMs: Date.now() - startedAt,
      data: { step: "ingredients-retake", source: frame.source, width: frame.width, height: frame.height, sharpness: frame.sharpness },
    });
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(productId)}/ingredients-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...scanFlowHeaders(flowId) },
        body: JSON.stringify({ photo: frame.url }),
      });
      if (leavingRef.current) return;
      const data = response.ok ? ((await response.json()) as { ingredientsFound?: boolean }) : null;
      if (data?.ingredientsFound) {
        leavingRef.current = true;
        stopCamera();
        router.replace(productHref);
        return;
      }
      setResult(data ? "unreadable" : "failed");
    } catch {
      if (leavingRef.current) return;
      setResult("failed");
    }
    setPhoto(null);
    setWorking(false);
  }

  const capturePhotoRef = useRef(capturePhoto);
  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  });

  // Efter et ulæseligt foto venter kameraet på et tryk, så det ikke tager
  // det samme uskarpe billede igen og igen.
  const autoCaptureProgress = useAutoCapture(
    videoRef,
    cameraStatus === "active" && !working && !photo && result === "idle",
    () => void capturePhotoRef.current(),
  );

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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden bg-hf-black rounded-card">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          aria-label={t("camera.liveViewAriaLabel")}
        />
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("camera.photoAlt")} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!photo && (
          <div
            className="pointer-events-none absolute inset-[12%] border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.2)] transition-colors rounded-card"
            style={{ borderColor: autoCaptureProgress > 0 ? "var(--hf-color-brand)" : "rgba(255,255,255,0.8)" }}
          >
            <div
              className="absolute bottom-0 left-0 h-1 rounded-full transition-[width]"
              style={{ width: `${autoCaptureProgress * 100}%`, background: "var(--hf-color-brand)" }}
            />
          </div>
        )}
        {cameraMessage && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={
              cameraStatus === "denied" || cameraStatus === "error"
                ? () => {
                    setCameraStatus("starting");
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

      <p className="hf-type-small text-text-secondary text-center">
        {result === "unreadable"
          ? t("cameraCreate.retakeStillUnreadable")
          : result === "failed"
            ? t("cameraCreate.retakeFailed")
            : t("cameraCreate.hintIngredients")}
      </p>
      {result === "idle" && (
        <p className="hf-type-micro text-text-secondary text-center">{t("camera.autoCaptureHint")}</p>
      )}
      <button
        type="button"
        onClick={() => void capturePhoto()}
        disabled={cameraStatus !== "active" || working}
        className="hf-control hf-btn-primary justify-center gap-2"
      >
        <IconCamera size={19} /> {t("camera.takePhoto")}
      </button>
      <Link
        href={productHref}
        replace
        onClick={() => {
          leavingRef.current = true;
        }}
        className="hf-control hf-btn-secondary justify-center"
      >
        {t("cameraCreate.retakeBack")}
      </Link>
    </div>
  );
}
