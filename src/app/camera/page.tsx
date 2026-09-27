"use client";

import { mealShareBody } from "@/lib/meal-share";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { HelloFreshMatchReview } from "@/components/HelloFreshMatchReview";
import { ProductCaptureFlow } from "@/components/camera/ProductCaptureFlow";
import { useTranslation } from "@/i18n/LocaleProvider";

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
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

// Stregkode/HelloFresh-fanerne — kun under Opret ret.
function ModeTabs({ mode }: { mode: CameraMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <div className="flex justify-center gap-2">
      {MODE_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (tab.key !== mode) router.replace(`/camera?mode=${tab.key}&for=ret`);
          }}
          className={
            tab.key === mode
              ? "hf-btn-primary px-4 py-1.5"
              : "hf-btn-secondary px-4 py-1.5"
          }
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}

function KameraContent() {
  const params = useSearchParams();
  const modeParam = params.get("mode");
  const forDish = params.get("for") === "ret";
  // HelloFresh-genkendelse ("Produkt"-fanen) kun under Opret ret
  // (docs/DECISIONS.md 2026-09-24) — ellers altid stregkode.
  const mode: CameraMode =
    modeParam === "meal" ? "meal" : modeParam === "hellofresh" && forDish ? "hellofresh" : "product";

  // Stregkode → forside → energi → indhold (docs/DECISIONS.md 2026-09-27).
  if (mode === "product") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
        {forDish && <ModeTabs mode={mode} />}
        <ProductCaptureFlow returnSuffix={forDish ? "?for=ret" : ""} />
      </div>
    );
  }
  return <PhotoModeContent key={mode} mode={mode} forDish={forDish} />;
}

function PhotoModeContent({ mode, forDish }: { mode: "meal" | "hellofresh"; forDish: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const returnSuffix = forDish ? "?for=ret" : "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeStatus>("idle");
  const [matchedProduct, setMatchedProduct] = useState<MatchedHelloFreshProduct | null>(null);
  const [mealAnalyzeStatus, setMealAnalyzeStatus] = useState<MealAnalyzeStatus>("idle");
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [mealSaving, setMealSaving] = useState(false);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

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
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (cancelled) return;
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
      {mode === "hellofresh" && forDish && <ModeTabs mode={mode} />}

      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("camera.photoAlt")} className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label={t("camera.liveViewAriaLabel")} />
        )}

        {!photo && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] rounded-full border-2 border-hf-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
          </div>
        )}

        {message && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{message}</p>
          </div>
        )}

        {cameraStatus === "active" && !photo && (
          <p className="hf-type-small hf-type-strong absolute inset-x-4 top-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-hf-white">
            {mode === "hellofresh" ? t("camera.placeProductInCircle") : t("camera.placePlateInCircle")}
          </p>
        )}

        {mode === "hellofresh" && recognizeStatus === "not_found" && (
          <button
            type="button"
            onClick={restartCamera}
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{t("camera.notRecognizedRetry")}</p>
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
            <button onClick={capturePhoto} disabled={cameraStatus !== "active"} className="hf-control hf-btn-primary gap-2 px-6 disabled:opacity-40">
              <IconCamera size={19} /> {t("camera.takePhotoOfProduct")}
            </button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center py-1">
            {photo ? (
              <button onClick={restartCamera} className="hf-control hf-btn-secondary gap-2 px-5">
                {t("camera.retakePhoto")}
              </button>
            ) : (
              <button onClick={capturePhoto} disabled={cameraStatus !== "active"} className="hf-control hf-btn-primary gap-2 px-6 disabled:opacity-40">
                <IconCamera size={19} /> {t("camera.takePhoto")}
              </button>
            )}
          </div>

          {photo && mealAnalyzeStatus === "idle" && (
            <p className="hf-type-small hf-type-strong text-text-secondary text-center">{t("camera.analyzingMeal")}</p>
          )}
          {photo && mealAnalyzeStatus === "error" && (
            <p className="hf-type-small hf-type-strong text-center text-hf-red-dark">{t("camera.mealAnalyzeError")}</p>
          )}
          {photo && mealAnalyzeStatus === "done" && mealItems.length === 0 && (
            <p className="hf-type-small hf-type-strong text-text-secondary text-center">
              {t("camera.noMealItemsFound")}
            </p>
          )}
          {photo && mealAnalyzeStatus === "done" && mealItems.length > 0 && (
            <>
              <ul className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
                {mealItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2.5 rounded-[8px] bg-hf-tan p-4">
                    <div className="min-w-0 flex-1">
                      <p className="hf-type-body hf-type-strong flex items-center gap-1.5 text-hf-black">
                        <span className="truncate">{item.title}</span>
                        {item.estimated && (
                          <span className="hf-type-micro hf-type-strong flex-shrink-0 rounded-full bg-hf-white px-1.5 py-0.5 uppercase text-hf-black opacity-70">
                            {t("camera.aiEstimateBadge")}
                          </span>
                        )}
                      </p>
                      <p className="hf-type-small text-text-secondary">
                        {item.amountLabel} · {item.kcal} kcal
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMealItem(item.id)}
                      className="hf-btn-text text-text-secondary flex-shrink-0"
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
                className="hf-control hf-btn-primary justify-center disabled:opacity-40"
              >
                {mealSaving ? t("camera.savingMeal") : t("camera.saveMeal")}
              </button>
            </>
          )}
        </div>
      )}

      {mode === "hellofresh" && (
        <Link href={`/foods/new${returnSuffix}`} className="hf-control hf-btn-secondary justify-center">
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
