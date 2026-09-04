"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { ChecksumException, FormatException, NotFoundException } from "@zxing/library";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { HelloFreshMatchReview } from "@/components/HelloFreshMatchReview";
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
  const mode: CameraMode =
    modeParam === "meal" ? "meal" : modeParam === "hellofresh" ? "hellofresh" : "product";
  const forDish = params.get("for") === "ret";
  const returnSuffix = forDish ? "?for=ret" : "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [photo, setPhoto] = useState<string | null>(null);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeStatus>("idle");
  const [matchedProduct, setMatchedProduct] = useState<MatchedHelloFreshProduct | null>(null);
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
              if (result && !lookupInProgressRef.current) {
                void lookupBarcode(result.getText());
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
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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
  }, [lookupBarcode, mode, restartKey, stopCamera]);

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
    setRestartKey((key) => key + 1);
  }

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

  function submitManualBarcode(event: React.FormEvent) {
    event.preventDefault();
    void lookupBarcode(barcode);
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
          <div className="pointer-events-none absolute inset-[18%] border-2 border-white/80">
            <span className="absolute -inset-0.5 border-[6px] border-transparent border-t-hf-green" />
          </div>
        )}

        {message && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="max-w-xs text-sm font-semibold text-white">{message}</p>
          </div>
        )}

        {cameraStatus === "active" && !photo && (
          <p className="absolute inset-x-4 top-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-xs font-semibold text-white">
            {mode === "product"
              ? t("camera.holdBarcodeInFrame")
              : mode === "hellofresh"
                ? t("camera.placeProductInCircle")
                : t("camera.placePlateInCircle")}
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
              <ul className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
                {mealItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-[8px] bg-hf-tan p-3">
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
          <p className="mb-2 text-xs text-hf-black opacity-70">
            {lookupStatus === "loading"
              ? t("camera.lookingUp", { code: barcode })
              : lookupStatus === "not_found"
                ? t("camera.barcodeNotFound")
                : lookupStatus === "error"
                  ? t("camera.barcodeLookupError")
                  : t("camera.autoScanHint")}
          </p>
          <form onSubmit={submitManualBarcode} className="flex gap-2">
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              aria-label={t("camera.barcodeNumberAriaLabel")}
              placeholder={t("camera.barcodeNumberAriaLabel")}
              className="min-w-0 flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none"
            />
            <button disabled={!barcode || lookupStatus === "loading"} className="hf-btn-primary px-4 py-2 text-xs disabled:opacity-40">
              {t("camera.lookUp")}
            </button>
          </form>
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
