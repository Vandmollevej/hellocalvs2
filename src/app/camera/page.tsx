"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { ChecksumException, FormatException, NotFoundException } from "@zxing/library";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { BarcodeScanOverlay, type BarcodeAlignment } from "@/components/hf/BarcodeScanOverlay";
import { CameraDetectionOverlay } from "@/components/hf/CameraDetectionOverlay";
import { ScanningOverlay } from "@/components/hf/ScanningOverlay";
import {
  barcodeGuideBoxFraction,
  decodedPointsToFraction,
  detectBarcodeOrientation,
  pointInRect,
  rectCenter,
  type BarcodeOrientation,
  type FractionRect,
} from "@/lib/barcode-scan";
import { buildFakeBarcodeForRegion } from "@/lib/regions";
import { captureSquareFrame, meanLuma, sampleThumbnail, thumbnailDifference } from "@/lib/camera-frame";
import type { CameraDetection, CameraDetectionResponse } from "@/lib/camera-detection-types";
import { useTranslation } from "@/i18n/LocaleProvider";

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type LookupStatus = "idle" | "loading" | "not_found" | "error";
// "detect" is the "Produkt" tab: automatic AI detection with outlines
// (docs/DECISIONS.md 2026-09-25). The legacy `mode=hellofresh` URL maps to it.
type CameraMode = "product" | "meal" | "detect";
type DetectStatus = "scanning" | "analyzing" | "nothing" | "error" | "done";
type MealAnalyzeStatus = "idle" | "done" | "error";
type MealItem = {
  id: string;
  title: string;
  amountGrams: number;
  amountLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  productId: string | null;
  image: string | null;
  estimated: boolean;
};

const MODE_TABS: { key: CameraMode; labelKey: string }[] = [
  { key: "product", labelKey: "camera.tabBarcode" },
  { key: "detect", labelKey: "camera.tabProduct" },
];

// Automatic capture in the "Produkt" tab: sample the viewfinder a few times a
// second and send a frame to AI only once the camera has been held still for
// a moment, the picture isn't black, and the scene differs from the last
// frame that was sent (or that one is a while ago). A shaky hand never blocks
// it for good: after FORCE_SEND_AFTER_MS a frame is sent even if not steady.
const SAMPLE_INTERVAL_MS = 350;
const STEADY_SAMPLES_NEEDED = 3;
const STEADY_MAX_DIFFERENCE = 9;
const FORCE_SEND_AFTER_MS = 4000;
const SCENE_CHANGED_DIFFERENCE = 12;
const RESEND_SAME_SCENE_AFTER_MS = 6000;
const MIN_LUMA = 16;
// If the video element still has no frames this long after the camera was
// reported as started, the stream is dead (the "100 % sort" viewfinder) —
// restart it, a limited number of times.
const BLACK_VIDEO_TIMEOUT_MS = 2500;
const MAX_AUTO_RESTARTS = 2;

function cameraMessage(status: CameraStatus, t: (key: string) => string) {
  if (status === "starting") return t("camera.starting");
  if (status === "denied") return t("camera.deniedAccess");
  if (status === "unavailable") return t("camera.unavailable");
  if (status === "error") return t("camera.error");
  return null;
}

function statusFromCameraError(error: unknown): CameraStatus {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  return "error";
}

function KameraContent() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const modeParam = params.get("mode");
  const mode: CameraMode =
    modeParam === "meal"
      ? "meal"
      : modeParam === "detect" || modeParam === "hellofresh"
        ? "detect"
        : "product";
  const forDish = params.get("for") === "ret";
  const returnSuffix = forDish ? "?for=ret" : "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);
  const confirmTriggeredRef = useRef(false);
  const lastBarcodeDetectionAtRef = useRef(0);
  // Camera starts are chained so a still-pending start (e.g. the barcode
  // reader from the tab being left) has finished and released the <video>
  // before the next one attaches its stream. Without this, @zxing's late
  // stop() cleared the new stream from the shared element: a black viewfinder.
  const cameraQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoRestartsRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [region, setRegion] = useState("DK");
  const [barcodeAlignment, setBarcodeAlignment] = useState<BarcodeAlignment>("idle");
  const [barcodeConfirmed, setBarcodeConfirmed] = useState(false);
  const [decodedBarcodeRect, setDecodedBarcodeRect] = useState<FractionRect | null>(null);
  const [barcodeHint, setBarcodeHint] = useState<string | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>("scanning");
  const [detections, setDetections] = useState<CameraDetection[]>([]);
  const [mealAnalyzeStatus, setMealAnalyzeStatus] = useState<MealAnalyzeStatus>("idle");
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [mealSaving, setMealSaving] = useState(false);
  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const lookupBarcode = useCallback(async (code: string) => {
    const cleanedCode = code.trim();
    if (!cleanedCode || lookupInProgressRef.current) return;

    lookupInProgressRef.current = true;
    setBarcode(cleanedCode);
    setLookupStatus("loading");

    try {
      const response = await fetch(`/api/products/lookup/${encodeURIComponent(cleanedCode)}`);
      if (response.status === 404) {
        setLookupStatus("not_found");
        lookupInProgressRef.current = false;
        return;
      }
      if (!response.ok) throw new Error("Product lookup failed");

      const data = (await response.json()) as { product: { id: string } };
      stopCamera();
      router.push(`/add/${data.product.id}${returnSuffix}`);
    } catch {
      setLookupStatus("error");
      lookupInProgressRef.current = false;
    }
  }, [router, stopCamera, returnSuffix]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (cancelled) return;
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }

      try {
        if (mode === "product") {
          const reader = new BrowserMultiFormatOneDReader(undefined, {
            delayBetweenScanAttempts: 250,
            delayBetweenScanSuccess: 1000,
          });
          const controls = await reader.decodeFromConstraints(
            { audio: false, video: { facingMode: { ideal: "environment" } } },
            videoRef.current,
            (result, error) => {
              if (result) {
                if (confirmTriggeredRef.current) return;
                lastBarcodeDetectionAtRef.current = Date.now();
                const resultPoints = result.getResultPoints();
                const detectedOrientation = detectBarcodeOrientation(resultPoints);
                setBarcodeOrientation((current) =>
                  current === detectedOrientation ? current : detectedOrientation
                );
                const video = videoRef.current;
                const rect = video
                  ? decodedPointsToFraction(resultPoints, video.videoWidth, video.videoHeight)
                  : null;
                const guideBoxForOrientation = barcodeGuideBoxFraction(detectedOrientation);
                const aligned = rect ? pointInRect(rectCenter(rect), guideBoxForOrientation) : false;
                if (aligned && !lookupInProgressRef.current) {
                  confirmTriggeredRef.current = true;
                  setBarcodeAlignment("aligned");
                  setDecodedBarcodeRect(rect);
                  setBarcodeConfirmed(true);
                  setBarcodeHint(null);
                  const code = result.getText();
                  // Brief pause so the green "read" highlight is actually visible
                  // before navigating away, per the requested scan feedback.
                  setTimeout(() => void lookupBarcode(code), 450);
                } else {
                  setBarcodeAlignment("misaligned");
                  setDecodedBarcodeRect(null);
                }
                return;
              }
              // NotFoundException/ChecksumException/FormatException fire on every
              // frame that doesn't contain a readable barcode yet — expected noise
              // during normal scanning, not a failure. Anything else means the
              // decode loop has stopped for good, so surface it instead of leaving
              // a frozen, silently-broken camera view.
              if (
                error &&
                !(error instanceof NotFoundException) &&
                !(error instanceof ChecksumException) &&
                !(error instanceof FormatException)
              ) {
                setCameraStatus("error");
              }
            },
          );
          if (cancelled) controls.stop();
          else {
            scannerControlsRef.current = controls;
            setCameraStatus("active");
          }
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setCameraStatus("active");
      } catch (error) {
        if (!cancelled) setCameraStatus(statusFromCameraError(error));
      }
    }

    const run = cameraQueueRef.current.then(startCamera);
    cameraQueueRef.current = run.catch(() => {});
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [barcodeGuideBox, lookupBarcode, mode, restartKey, stopCamera]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.88));
    stopCamera();
  }

  function restartCamera() {
    stopCamera();
    setPhoto(null);
    setCameraStatus("starting");
    lookupInProgressRef.current = false;
    setLookupStatus("idle");
    setDetectStatus("scanning");
    setDetections([]);
    setMealAnalyzeStatus("idle");
    setMealItems([]);
    confirmTriggeredRef.current = false;
    lastBarcodeDetectionAtRef.current = 0;
    setBarcodeAlignment("idle");
    setBarcodeConfirmed(false);
    setDecodedBarcodeRect(null);
    setBarcodeHint(null);
    setBarcodeOrientation("horizontal");
    setRestartKey((key) => key + 1);
  }

  // Fetches the signed-in user's region once, so the fictional barcode guide
  // starts with their real GS1 prefix (see src/lib/regions.ts). Defaults to
  // "DK" (matches the User.region schema default) while loading or on error.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { region?: string } } | null) => {
        if (!cancelled && data?.user?.region) setRegion(data.user.region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Decays a stale "aligned"/"misaligned" barcode-frame state back to "idle"
  // once no barcode has been detected anywhere in frame for a while (e.g. the
  // user moved the camera away entirely), so the frame doesn't stay red/green
  // forever from a single old detection.
  useEffect(() => {
    if (mode !== "product") return;
    const interval = setInterval(() => {
      if (confirmTriggeredRef.current) return;
      if (Date.now() - lastBarcodeDetectionAtRef.current > 900) {
        setBarcodeAlignment("idle");
        setDecodedBarcodeRect(null);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [mode, restartKey]);

  // After a while without a confirmed read, rotate a couple of translucent
  // hint messages over the viewfinder (blurry / not aligned) — hidden again
  // the moment a barcode is confirmed, or when the camera is restarted.
  useEffect(() => {
    if (mode !== "product" || cameraStatus !== "active") return;
    const hints = [t("camera.barcodeHintOutsideFrame"), t("camera.barcodeHintBlurry")];
    let index = 0;
    let rotateTimer: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      setBarcodeHint(hints[index]);
      rotateTimer = setInterval(() => {
        index = (index + 1) % hints.length;
        setBarcodeHint(hints[index]);
      }, 4000);
    }, 6000);
    return () => {
      clearTimeout(startTimer);
      if (rotateTimer) clearInterval(rotateTimer);
      setBarcodeHint(null);
    };
  }, [mode, cameraStatus, restartKey, t]);

  const detectedItems = useMemo(() => detections.flatMap((detection) => detection.items), [detections]);
  const listItems = mode === "detect" ? detectedItems : mealItems;

  function removeItem(id: string) {
    setMealItems((current) => current.filter((item) => item.id !== id));
    setDetections((current) =>
      current.map((detection) => ({
        ...detection,
        items: detection.items.filter((item) => item.id !== id),
      }))
    );
  }

  async function saveItems() {
    if (mealSaving || listItems.length === 0) return;
    setMealSaving(true);
    try {
      await Promise.all(
        listItems.map((item) =>
          fetch("/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              item.productId
                ? { productId: item.productId, amountGrams: item.amountGrams }
                : {
                    amountGrams: item.amountGrams,
                    titleSnapshot: item.title,
                    kcalSnapshot: item.kcal,
                    proteinSnapshot: item.protein,
                    carbsSnapshot: item.carbs,
                    fatSnapshot: item.fat,
                  }
            ),
          })
        )
      );
      stopCamera();
      router.push("/");
    } catch {
      setMealSaving(false);
    }
  }

  useEffect(() => {
    if (mode !== "meal" || !photo) return;
    let cancelled = false;
    fetch("/api/ai/analyze-meal-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo }),
    })
      .then((res) => res.json())
      .then((data: { items: Omit<MealItem, "id">[] }) => {
        if (cancelled) return;
        setMealItems(data.items.map((item, index) => ({ ...item, id: `${index}` })));
        setMealAnalyzeStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setMealAnalyzeStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, photo]);

  // Black-viewfinder watchdog: the camera reported "active" but the <video>
  // never got a frame (stream muted/ended, or detached from the element).
  useEffect(() => {
    if (cameraStatus !== "active" || photo) return;
    const timer = setTimeout(() => {
      const video = videoRef.current;
      const stream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
      const live = stream?.getVideoTracks().some((track) => track.readyState === "live") ?? false;
      if (video && video.videoWidth > 0 && live) {
        autoRestartsRef.current = 0;
        return;
      }
      if (autoRestartsRef.current >= MAX_AUTO_RESTARTS) {
        setCameraStatus("error");
        return;
      }
      autoRestartsRef.current += 1;
      restartCamera();
    }, BLACK_VIDEO_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStatus, photo, restartKey]);

  // "Produkt" tab: no shutter button — watch the viewfinder and send a frame
  // to AI on its own once the camera is held still over something new. The
  // first answer with food in it freezes that frame, outlines what was found
  // and lists it below.
  useEffect(() => {
    if (mode !== "detect" || cameraStatus !== "active" || photo) return;
    const sampleCanvas = document.createElement("canvas");
    const controller = new AbortController();
    let previous: Uint8Array | null = null;
    let lastSent: Uint8Array | null = null;
    let lastSentAt = Date.now();
    let steadySamples = 0;
    let busy = false;
    let pausedUntil = 0;

    async function analyze(frame: string) {
      busy = true;
      setDetectStatus("analyzing");
      try {
        const response = await fetch("/api/ai/detect-camera-objects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: frame, includeHelloFresh: forDish }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Detection failed");
        const data = (await response.json()) as CameraDetectionResponse;
        if (controller.signal.aborted) return;
        const found = data.detections.filter((detection) => detection.items.length > 0);
        if (found.length === 0) {
          setDetectStatus("nothing");
          return;
        }
        setDetections(found);
        setPhoto(frame);
        setDetectStatus("done");
        stopCamera();
      } catch {
        if (controller.signal.aborted) return;
        setDetectStatus("error");
        pausedUntil = Date.now() + 4000;
      } finally {
        busy = false;
      }
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (busy || !video || Date.now() < pausedUntil) return;
      const thumbnail = sampleThumbnail(video, sampleCanvas);
      if (!thumbnail) return;
      const steady = previous !== null && thumbnailDifference(previous, thumbnail) < STEADY_MAX_DIFFERENCE;
      previous = thumbnail;
      steadySamples = steady ? steadySamples + 1 : 0;
      if (meanLuma(thumbnail) < MIN_LUMA) return;
      if (steadySamples < STEADY_SAMPLES_NEEDED && Date.now() - lastSentAt < FORCE_SEND_AFTER_MS) return;

      const sceneChanged = !lastSent || thumbnailDifference(lastSent, thumbnail) > SCENE_CHANGED_DIFFERENCE;
      if (!sceneChanged && Date.now() - lastSentAt < RESEND_SAME_SCENE_AFTER_MS) return;

      const frame = captureSquareFrame(video);
      if (!frame) return;
      lastSent = thumbnail;
      lastSentAt = Date.now();
      steadySamples = 0;
      void analyze(frame);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [mode, cameraStatus, photo, forDish, stopCamera]);

  // Once results are in, the viewfinder shrinks and the list scrolls into view.
  useEffect(() => {
    if (detectStatus !== "done") return;
    const timer = setTimeout(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => clearTimeout(timer);
  }, [detectStatus]);

  const message = cameraMessage(cameraStatus, t);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      {mode !== "meal" && (
        <div className="flex justify-center gap-2">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === mode) return;
                restartCamera();
                router.replace(`/camera?mode=${tab.key}${forDish ? "&for=ret" : ""}`);
              }}
              className={
                tab.key === mode
                  ? "hf-btn-primary px-4 py-1.5 text-xs"
                  : "hf-btn-secondary px-4 py-1.5 text-xs"
              }
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      )}

      <div
        className={`relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-[12px] bg-hf-black transition-[max-height] duration-500 ease-out ${
          mode === "detect" && detectStatus === "done" ? "max-h-[36vh]" : "max-h-[calc(100vw-2rem)]"
        }`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("camera.photoAlt")} className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label={t("camera.liveViewAriaLabel")} />
        )}

        {photo && mode === "detect" && detections.length > 0 && (
          <CameraDetectionOverlay detections={detections} />
        )}

        {!photo && mode === "detect" && detectStatus === "analyzing" && (
          <ScanningOverlay label={t("camera.detectAnalyzing")} />
        )}

        {!photo && mode === "meal" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
          </div>
        )}

        {!photo && mode === "product" && (
          <BarcodeScanOverlay
            guideBox={barcodeGuideBox}
            orientation={barcodeOrientation}
            alignment={barcodeAlignment}
            confirmed={barcodeConfirmed}
            fakeCode={fakeBarcode}
            decodedRect={decodedBarcodeRect}
            hintText={barcodeHint}
          />
        )}

        {message && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="max-w-xs text-sm font-semibold text-white">{message}</p>
          </div>
        )}

        {cameraStatus === "active" && !photo && mode !== "product" && (
          <p className="absolute inset-x-4 top-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-xs font-semibold text-white">
            {mode === "detect"
              ? detectStatus === "nothing"
                ? t("camera.detectNothingYet")
                : detectStatus === "error"
                  ? t("camera.detectError")
                  : t("camera.detectHoldStill")
              : t("camera.placePlateInCircle")}
          </p>
        )}
      </div>

      {mode === "product" && !photo && (
        <p className="text-center text-xs font-semibold text-hf-black opacity-70">
          {t("camera.holdCameraStill")}
        </p>
      )}

      {mode === "detect" ? (
        photo && (
          <div ref={listRef} className="flex scroll-mt-4 flex-col gap-3">
            <p className="text-sm font-bold text-hf-black">{t("camera.detectResultsTitle")}</p>
            <CameraItemList items={detectedItems} onRemove={removeItem} linkSuffix={returnSuffix} />
            {detectedItems.length > 0 && (
              <button
                type="button"
                onClick={saveItems}
                disabled={mealSaving}
                className="hf-btn-primary justify-center py-3 text-sm disabled:opacity-40"
              >
                {mealSaving ? t("camera.savingMeal") : t("camera.registerAll")}
              </button>
            )}
            <button type="button" onClick={restartCamera} className="hf-btn-secondary justify-center py-3 text-sm">
              {t("camera.scanAgain")}
            </button>
          </div>
        )
      ) : mode === "meal" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-center py-1">
            {photo ? (
              <button onClick={restartCamera} className="hf-btn-secondary gap-2 px-5 py-3 text-sm">
                {t("camera.retakePhoto")}
              </button>
            ) : (
              <button onClick={capturePhoto} disabled={cameraStatus !== "active"} className="hf-btn-primary gap-2 px-6 py-3 text-sm disabled:opacity-40">
                <IconCamera size={19} /> {t("camera.takePhoto")}
              </button>
            )}
          </div>

          {photo && mealAnalyzeStatus === "idle" && (
            <p className="text-center text-xs font-semibold text-hf-black opacity-70">{t("camera.analyzingMeal")}</p>
          )}
          {photo && mealAnalyzeStatus === "error" && (
            <p className="text-center text-xs font-semibold text-red-700">{t("camera.mealAnalyzeError")}</p>
          )}
          {photo && mealAnalyzeStatus === "done" && mealItems.length === 0 && (
            <p className="text-center text-xs font-semibold text-hf-black opacity-70">
              {t("camera.noMealItemsFound")}
            </p>
          )}
          {photo && mealAnalyzeStatus === "done" && mealItems.length > 0 && (
            <>
              <CameraItemList items={mealItems} onRemove={removeItem} />
              <button
                type="button"
                onClick={saveItems}
                disabled={mealSaving}
                className="hf-btn-primary justify-center py-3 text-sm disabled:opacity-40"
              >
                {mealSaving ? t("camera.savingMeal") : t("camera.saveMeal")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-[8px] bg-hf-tan p-4">
          <p className="text-xs text-hf-black opacity-70">
            {lookupStatus === "loading"
              ? t("camera.lookingUp", { code: barcode })
              : lookupStatus === "not_found"
                ? t("camera.barcodeNotFound")
                : lookupStatus === "error"
                  ? t("camera.barcodeLookupError")
                  : t("camera.autoScanHint")}
          </p>
        </div>
      )}

      {mode !== "meal" && (
        <Link href={`/foods/new${returnSuffix}`} className="hf-btn-secondary justify-center py-2.5 text-xs">
          {t("camera.addManually")}
        </Link>
      )}
    </div>
  );
}

type ListItem = Pick<MealItem, "id" | "title" | "amountLabel" | "kcal" | "estimated" | "productId">;

// Recognized foods under the viewfinder (Måltid and Produkt tabs). With
// `linkSuffix`, a row matched to one of our products opens its normal
// registration screen, so amount/portion can be adjusted there.
function CameraItemList({
  items,
  onRemove,
  linkSuffix,
}: {
  items: ListItem[];
  onRemove: (id: string) => void;
  linkSuffix?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const content = (
          <>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-hf-black">
              <span className="truncate">{item.title}</span>
              {item.estimated && (
                <span className="flex-shrink-0 rounded-full bg-hf-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-hf-black opacity-70">
                  {t("camera.aiEstimateBadge")}
                </span>
              )}
            </p>
            <p className="text-xs text-hf-black opacity-60">
              {item.amountLabel} · {item.kcal} kcal
            </p>
          </>
        );
        return (
          <li key={item.id} className="flex items-center gap-2.5 rounded-[8px] bg-hf-tan p-3">
            {linkSuffix !== undefined && item.productId ? (
              <Link href={`/add/${item.productId}${linkSuffix}`} className="min-w-0 flex-1">
                {content}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{content}</div>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex-shrink-0 text-xs font-semibold text-hf-black opacity-60 underline"
            >
              {t("camera.removeItem")}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function CameraPage() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("camera.title")}>
      <Suspense fallback={null}>
        <KameraContent />
      </Suspense>
    </HfScreen>
  );
}
