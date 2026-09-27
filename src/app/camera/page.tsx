"use client";

import { mealShareBody } from "@/lib/meal-share";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { HelloFreshMatchReview } from "@/components/HelloFreshMatchReview";
import { BarcodeScanOverlay, type BarcodeDetection } from "@/components/hf/BarcodeScanOverlay";
import {
  barcodeGuideBoxFraction,
  barcodePoseFromPoints,
  orientationFromPose,
  type BarcodeOrientation,
} from "@/lib/barcode-scan";
import { startBarcodeFrameScanner, type BarcodeRead } from "@/lib/barcode-frame-scanner";
import { buildFakeBarcodeForRegion } from "@/lib/regions";
import { useTranslation } from "@/i18n/LocaleProvider";

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type LookupStatus = "idle" | "loading" | "not_found" | "error";
type CameraMode = "product" | "meal" | "hellofresh";
type RecognizeStatus = "idle" | "processing" | "found" | "not_found" | "failed";
type MatchedHelloFreshProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  servingSizeGrams: number | null;
  servingSizeUnitSingular?: string | null;
};
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

// How long the bar-by-bar / digit-by-digit decode animation runs before the
// product lookup starts (BarcodeScanOverlay's BAR_DRAW_MS + digits).
const DECODE_ANIMATION_MS = 1300;
const DECODE_ANIMATION_REDUCED_MS = 300;
// A detection with no fresh read for this long is treated as gone.
const DETECTION_STALE_MS = 1200;

const MODE_TABS: { key: CameraMode; labelKey: string }[] = [
  { key: "product", labelKey: "camera.tabBarcode" },
  { key: "hellofresh", labelKey: "camera.tabProduct" },
];

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
  const forDish = params.get("for") === "ret";
  // HelloFresh-genkendelse ("Produkt"-fanen) kun under Opret ret
  // (docs/DECISIONS.md 2026-09-24) — ellers altid stregkode.
  const mode: CameraMode =
    modeParam === "meal" ? "meal" : modeParam === "hellofresh" && forDish ? "hellofresh" : "product";
  const returnSuffix = forDish ? "?for=ret" : "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopScannerRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);
  const activeCodeRef = useRef<string | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeSeenAtRef = useRef(0);
  const notFoundCodesRef = useRef(new Set<string>());
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [region, setRegion] = useState("DK");
  const [barcodeDetection, setBarcodeDetection] = useState<BarcodeDetection | null>(null);
  const [barcodeHint, setBarcodeHint] = useState<string | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeStatus>("idle");
  const [matchedProduct, setMatchedProduct] = useState<MatchedHelloFreshProduct | null>(null);
  const [mealAnalyzeStatus, setMealAnalyzeStatus] = useState<MealAnalyzeStatus>("idle");
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [mealSaving, setMealSaving] = useState(false);
  const stopCamera = useCallback(() => {
    stopScannerRef.current?.();
    stopScannerRef.current = null;
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = null;
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
        // Remember it, so holding the same barcode in view doesn't loop the
        // animation + lookup; its overlay turns red instead (see handleBarcodeRead).
        notFoundCodesRef.current.add(cleanedCode);
        setBarcodeDetection((current) => (current?.code === cleanedCode ? { ...current, tone: "failed" } : current));
        setLookupStatus("not_found");
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
        return;
      }
      if (!response.ok) throw new Error("Product lookup failed");

      const data = (await response.json()) as { product: { id: string } };
      stopCamera();
      router.push(`/add/${data.product.id}${returnSuffix}`);
    } catch {
      setLookupStatus("error");
      activeCodeRef.current = null;
      lookupInProgressRef.current = false;
    }
  }, [router, stopCamera, returnSuffix]);

  // Every successful frame read: start the decode animation on a new code
  // (and the lookup once it has played), or just move the overlay along with
  // a code that's already being decoded, so it stays on the physical barcode.
  const handleBarcodeRead = useCallback((read: BarcodeRead) => {
    const pose = barcodePoseFromPoints(read.points, read.side, read.barExtent, read.tiltDeg);
    if (!pose) return;
    const { text: code, symbology } = read;
    if (lookupInProgressRef.current && code !== activeCodeRef.current) return;

    lastBarcodeSeenAtRef.current = Date.now();
    const orientation = orientationFromPose(pose);
    setBarcodeOrientation((current) => (current === orientation ? current : orientation));

    if (notFoundCodesRef.current.has(code)) {
      setBarcodeDetection({ code, symbology, pose, tone: "failed" });
      return;
    }
    if (activeCodeRef.current === code) {
      setBarcodeDetection((current) => (current?.code === code ? { ...current, pose } : current));
      return;
    }

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    activeCodeRef.current = code;
    setLookupStatus("idle");
    setBarcodeDetection({ code, symbology, pose, tone: "reading" });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lookupTimerRef.current = setTimeout(
      () => {
        lookupTimerRef.current = null;
        void lookupBarcode(code);
      },
      reducedMotion ? DECODE_ANIMATION_REDUCED_MS : DECODE_ANIMATION_MS
    );
  }, [lookupBarcode]);
  // Read through a ref so a new handler identity never restarts the camera.
  const handleBarcodeReadRef = useRef(handleBarcodeRead);
  useEffect(() => {
    handleBarcodeReadRef.current = handleBarcodeRead;
  }, [handleBarcodeRead]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video:
            mode === "product"
              ? // Higher resolution than the photo modes: thin bars need pixels.
                { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
              : { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;
        if (mode === "product") {
          stopScannerRef.current = startBarcodeFrameScanner(
            videoRef.current,
            (read) => handleBarcodeReadRef.current(read),
            () => {
              if (!cancelled) setCameraStatus("error");
            }
          );
        }
        setCameraStatus("active");

      } catch (error) {
        if (!cancelled) setCameraStatus(statusFromCameraError(error));
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, restartKey, stopCamera]);

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
    setRecognizeStatus("idle");
    setMatchedProduct(null);
    setMealAnalyzeStatus("idle");
    setMealItems([]);
    activeCodeRef.current = null;
    lastBarcodeSeenAtRef.current = 0;
    notFoundCodesRef.current.clear();
    setBarcodeDetection(null);
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

  // Clears the decode overlay once its barcode has left the picture — but
  // never while its animation or lookup is still running.
  useEffect(() => {
    if (mode !== "product") return;
    const interval = setInterval(() => {
      if (lookupInProgressRef.current || lookupTimerRef.current) return;
      if (Date.now() - lastBarcodeSeenAtRef.current > DETECTION_STALE_MS) {
        activeCodeRef.current = null;
        setBarcodeDetection((current) => (current ? null : current));
      }
    }, 300);
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

  function removeMealItem(id: string) {
    setMealItems((current) => current.filter((item) => item.id !== id));
  }

  async function saveMeal() {
    if (mealSaving || mealItems.length === 0) return;
    setMealSaving(true);
    try {
      await Promise.all(
        mealItems.map((item) =>
          fetch("/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(item.productId
                ? { productId: item.productId, amountGrams: item.amountGrams }
                : {
                    amountGrams: item.amountGrams,
                    titleSnapshot: item.title,
                    kcalSnapshot: item.kcal,
                    proteinSnapshot: item.protein,
                    carbsSnapshot: item.carbs,
                    fatSnapshot: item.fat,
                  }),
              // Fælles måltid (docs/FAMILY.md).
              ...mealShareBody(),
            }),
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
    if (mode !== "hellofresh" || !photo) return;
    let cancelled = false;
    fetch("/api/ai/recognize-hellofresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo }),
    })
      .then((res) => res.json())
      .then((data: { product: MatchedHelloFreshProduct | null }) => {
        if (cancelled) return;
        setMatchedProduct(data.product);
        setRecognizeStatus(data.product ? "found" : "not_found");
      })
      .catch(() => {
        if (cancelled) return;
        setRecognizeStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, photo]);

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

  useEffect(() => {
    if (recognizeStatus !== "not_found") return;
    const timer = setTimeout(() => restartCamera(), 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognizeStatus]);

  function confirmHelloFreshMatch() {
    if (!matchedProduct) return;
    stopCamera();
    router.push(`/add/${matchedProduct.id}`);
  }

  const message = cameraMessage(cameraStatus, t);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      {mode !== "meal" && forDish && (
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

      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("camera.photoAlt")} className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label={t("camera.liveViewAriaLabel")} />
        )}

        {!photo && (mode === "meal" || mode === "hellofresh") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
          </div>
        )}

        {!photo && mode === "product" && (
          <BarcodeScanOverlay
            guideBox={barcodeGuideBox}
            orientation={barcodeOrientation}
            fakeCode={fakeBarcode}
            detection={barcodeDetection}
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
            {mode === "hellofresh" ? t("camera.placeProductInCircle") : t("camera.placePlateInCircle")}
          </p>
        )}

        {mode === "hellofresh" && recognizeStatus === "not_found" && (
          <button
            type="button"
            onClick={restartCamera}
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
          >
            <p className="max-w-xs text-sm font-semibold text-white">{t("camera.notRecognizedRetry")}</p>
          </button>
        )}
      </div>

      {mode === "product" && !photo && (
        <p className="text-center text-xs font-semibold text-hf-black opacity-70">
          {t("camera.holdCameraStill")}
        </p>
      )}

      {mode === "hellofresh" ? (
        photo ? (
          recognizeStatus !== "not_found" && (
            <HelloFreshMatchReview
              status={recognizeStatus === "idle" ? "processing" : recognizeStatus}
              product={matchedProduct}
              onConfirm={confirmHelloFreshMatch}
              onRetake={restartCamera}
            />
          )
        ) : (
          <div className="flex justify-center py-1">
            <button onClick={capturePhoto} disabled={cameraStatus !== "active"} className="hf-btn-primary gap-2 px-6 py-3 text-sm disabled:opacity-40">
              <IconCamera size={19} /> {t("camera.takePhotoOfProduct")}
            </button>
          </div>
        )
      ) : mode === "meal" ? (
        <div className="flex flex-col gap-4">
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
              <ul className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
                {mealItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-[8px] bg-hf-tan p-4">
                    <div className="min-w-0 flex-1">
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
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMealItem(item.id)}
                      className="flex-shrink-0 text-xs font-semibold text-hf-black opacity-60 underline"
                    >
                      {t("camera.removeItem")}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={saveMeal}
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
