"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconBarcode, IconCamera, IconFlame, IconList, IconPhoto, type Icon } from "@tabler/icons-react";
import { BarcodeScanOverlay, type BarcodeDetection } from "@/components/hf/BarcodeScanOverlay";
import { CaptureCheckOverlay } from "@/components/hf/CaptureCheckOverlay";
import { PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import {
  barcodeGuideBoxFraction,
  barcodePoseFromPoints,
  orientationFromPose,
  type BarcodeOrientation,
} from "@/lib/barcode-scan";
import { startBarcodeFrameScanner, type BarcodeRead } from "@/lib/barcode-frame-scanner";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { buildFakeBarcodeForRegion } from "@/lib/regions";
import {
  CAPTURE_STEPS,
  createQuickProduct,
  readFrontPhoto,
  readIngredientsPhoto,
  readNutritionPhoto,
  saveBarcodePhoto,
  type CaptureData,
  type CaptureStep,
} from "@/lib/product-capture";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27). Fire knapper under
// kameraet — Stregkode, Forside, Energi, Indhold — og kameraet starter altid
// på stregkoden. En kendt stregkode går direkte til varen. En ukendt fører
// videre til forside → energi → indhold; hvert foto får et hvidt overlay med
// load-cirklen, mens den lokale OCR kører, og knappen får flueben, når den er
// klaret. Står indholdet på energifotoet, får begge flueben. Så snart alle er
// klaret, oprettes varen (POST /api/products/quick), og skærmen går til
// /add/[id]; OpenAI udfylder navn/brand/næring/indhold bagefter.

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";

// Decode-animationen i BarcodeScanOverlay (BAR_DRAW_MS + cifre), før opslaget.
const DECODE_ANIMATION_MS = 1300;
const DECODE_ANIMATION_REDUCED_MS = 300;
// En aflæsning uden ny læsning i så lang tid regnes for væk.
const DETECTION_STALE_MS = 1200;

const STEP_ICONS: Record<CaptureStep, Icon> = {
  barcode: IconBarcode,
  front: IconPhoto,
  nutrition: IconFlame,
  ingredients: IconList,
};

function statusFromCameraError(error: unknown): CameraStatus {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  return "error";
}

// Hele videobilledet i fuld opløsning — bevidst ingen beskæring
// (docs/DECISIONS.md 2026-09-17).
function captureFrame(video: HTMLVideoElement | null): string | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ProductCaptureFlow({ returnSuffix }: { returnSuffix: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScannerRef = useRef<(() => void) | null>(null);
  const lookupInProgressRef = useRef(false);
  const activeCodeRef = useRef<string | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeSeenAtRef = useRef(0);
  const dataRef = useRef<CaptureData>({});
  const leavingRef = useRef(false);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [step, setStep] = useState<CaptureStep>("barcode");
  const [done, setDone] = useState<Partial<Record<CaptureStep, boolean>>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [region, setRegion] = useState("DK");
  const [barcodeDetection, setBarcodeDetection] = useState<BarcodeDetection | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);

  const scanning = step === "barcode" && !done.barcode;

  // Brugerens region er det primære sprogsignal (docs/DECISIONS.md 2026-09-12)
  // og giver den fiktive stregkode-guide det rigtige GS1-præfiks.
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

  const stopScanner = useCallback(() => {
    stopScannerRef.current?.();
    stopScannerRef.current = null;
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopScanner();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopScanner]);

  const leaveTo = useCallback(
    (href: string) => {
      leavingRef.current = true;
      stopCamera();
      router.push(href);
    },
    [router, stopCamera],
  );

  // Én kamerastrøm til alle fire trin (høj opløsning, så tynde streger kan
  // læses) — den kører videre mellem trinnene, så der ikke ventes på kameraet.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
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

  function goToNextStep(completed: Partial<Record<CaptureStep, boolean>>) {
    const next = CAPTURE_STEPS.find((item) => !completed[item]);
    if (next) {
      setPhoto(null);
      setWorking(false);
      setStep(next);
      return;
    }
    void createProduct();
  }

  function markDone(...steps: CaptureStep[]) {
    const completed = { ...done, ...Object.fromEntries(steps.map((item) => [item, true])) };
    setDone(completed);
    return completed;
  }

  async function createProduct() {
    setWorking(true);
    setCreateFailed(false);
    try {
      const id = await createQuickProduct(dataRef.current, marketRegion());
      leaveTo(`/add/${id}${returnSuffix}`);
    } catch {
      setWorking(false);
      setCreateFailed(true);
    }
  }

  function marketRegion() {
    return buildBarcodeContext(dataRef.current.barcode ?? "", region).marketRegion;
  }

  function ocrLanguages() {
    return buildBarcodeContext(dataRef.current.barcode ?? "", region).primaryOcrLanguages;
  }

  const lookupBarcode = useCallback(
    async (code: string) => {
      if (lookupInProgressRef.current) return;
      lookupInProgressRef.current = true;
      setLookupError(false);
      try {
        const response = await fetch(`/api/products/lookup/${encodeURIComponent(code)}`);
        if (response.ok) {
          const data = (await response.json()) as { product: { id: string } };
          leaveTo(`/add/${data.product.id}${returnSuffix}`);
          return;
        }
        if (response.status !== 404) throw new Error("Product lookup failed");

        // Ukendt vare: gem stregkoden og gå videre til forsiden.
        const frame = captureFrame(videoRef.current);
        dataRef.current.barcode = code;
        const context = buildBarcodeContext(code, region);
        if (frame) {
          void saveBarcodePhoto(frame, code, context.marketRegion).then((id) => {
            if (id) dataRef.current.barcodeAnalysisId = id;
          });
        }
        stopScanner();
        setBarcodeDetection(null);
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
        setDone((current) => ({ ...current, barcode: true }));
        setStep("front");
      } catch {
        setLookupError(true);
        setBarcodeDetection(null);
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
      }
    },
    [leaveTo, region, returnSuffix, stopScanner],
  );

  // Hver aflæsning: start decode-animationen på en ny kode (og opslaget, når
  // den har kørt), eller flyt blot overlayet med en kode der allerede læses.
  const handleBarcodeRead = useCallback(
    (read: BarcodeRead) => {
      const pose = barcodePoseFromPoints(read.points, read.side, read.barExtent, read.tiltDeg);
      if (!pose) return;
      const { text: code, symbology } = read;
      if (lookupInProgressRef.current && code !== activeCodeRef.current) return;

      lastBarcodeSeenAtRef.current = Date.now();
      const orientation = orientationFromPose(pose);
      setBarcodeOrientation((current) => (current === orientation ? current : orientation));

      if (activeCodeRef.current === code) {
        setBarcodeDetection((current) => (current?.code === code ? { ...current, pose } : current));
        return;
      }

      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
      activeCodeRef.current = code;
      setLookupError(false);
      setBarcodeDetection({ code, symbology, pose, tone: "reading" });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lookupTimerRef.current = setTimeout(
        () => {
          lookupTimerRef.current = null;
          void lookupBarcode(code);
        },
        reducedMotion ? DECODE_ANIMATION_REDUCED_MS : DECODE_ANIMATION_MS,
      );
    },
    [lookupBarcode],
  );
  const handleBarcodeReadRef = useRef(handleBarcodeRead);
  useEffect(() => {
    handleBarcodeReadRef.current = handleBarcodeRead;
  }, [handleBarcodeRead]);

  // Stregkode-scanneren kører kun på Stregkode-trinnet.
  useEffect(() => {
    if (!scanning || cameraStatus !== "active" || !videoRef.current) return;
    stopScannerRef.current = startBarcodeFrameScanner(
      videoRef.current,
      (read) => handleBarcodeReadRef.current(read),
      () => setCameraStatus("error"),
    );
    return () => stopScanner();
  }, [scanning, cameraStatus, stopScanner]);

  // Fjerner decode-overlayet, når stregkoden har forladt billedet — men
  // aldrig mens animationen eller opslaget kører.
  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(() => {
      if (lookupInProgressRef.current || lookupTimerRef.current) return;
      if (Date.now() - lastBarcodeSeenAtRef.current > DETECTION_STALE_MS) {
        activeCodeRef.current = null;
        setBarcodeDetection((current) => (current ? null : current));
      }
    }, 300);
    return () => clearInterval(interval);
  }, [scanning]);

  async function capturePhoto() {
    if (working || step === "barcode") return;
    const frame = captureFrame(videoRef.current);
    if (!frame) return;
    setPhoto(frame);
    setWorking(true);
    const languages = ocrLanguages();
    const data = dataRef.current;

    if (step === "front") {
      data.frontPhoto = frame;
      const { duplicateId } = await readFrontPhoto(frame, languages);
      if (leavingRef.current) return;
      if (duplicateId) {
        leaveTo(`/add/${duplicateId}${returnSuffix}`);
        return;
      }
      goToNextStep(markDone("front"));
      return;
    }

    if (step === "nutrition") {
      const result = await readNutritionPhoto(frame, languages);
      if (leavingRef.current) return;
      data.nutritionPhoto = frame;
      data.nutritionOcrText = result.text;
      data.localNutrition = result.nutrition;
      if (result.ingredientsText) {
        // Indholdet står ved siden af næringstabellen: begge får flueben.
        data.ingredientsOnNutritionPhoto = true;
        data.localIngredientsText = result.ingredientsText;
        goToNextStep(markDone("nutrition", "ingredients"));
      } else {
        data.ingredientsOnNutritionPhoto = false;
        goToNextStep(markDone("nutrition"));
      }
      return;
    }

    const result = await readIngredientsPhoto(frame, languages);
    if (leavingRef.current) return;
    data.ingredientsPhoto = frame;
    data.ingredientsOcrText = result.text;
    data.ingredientsOnNutritionPhoto = false;
    if (result.ingredientsText) data.localIngredientsText = result.ingredientsText;
    goToNextStep(markDone("ingredients"));
  }

  function selectStep(next: CaptureStep) {
    if (working || next === step) return;
    // Uden stregkode kan intet andet trin aflæses (sprog/region følger den).
    if (next !== "barcode" && !done.barcode) return;
    if (next === "barcode" && done.barcode) return;
    setPhoto(null);
    setStep(next);
  }

  function restartCamera() {
    setCameraStatus("starting");
    setRestartKey((key) => key + 1);
  }

  const stepLabels: Record<CaptureStep, string> = {
    barcode: t("cameraCreate.stepBarcode"),
    front: t("cameraCreate.stepFront"),
    nutrition: t("cameraCreate.stepNutrition"),
    ingredients: t("cameraCreate.stepIngredients"),
  };
  const stepHints: Record<CaptureStep, string> = {
    barcode: lookupError ? t("camera.barcodeLookupError") : t("camera.holdCameraStill"),
    front: t("cameraCreate.hintFront"),
    nutrition: t("cameraCreate.hintNutrition"),
    ingredients: t("cameraCreate.hintIngredients"),
  };
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
      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black">
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

        {scanning && (
          <BarcodeScanOverlay
            guideBox={barcodeGuideBox}
            orientation={barcodeOrientation}
            fakeCode={fakeBarcode}
            detection={barcodeDetection}
            hintText={null}
          />
        )}

        {!scanning && !photo && (
          <div className="pointer-events-none absolute inset-[12%] rounded-[12px] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
        )}

        {cameraMessage && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{cameraMessage}</p>
          </div>
        )}

        {working && <PhotoWorkingOverlay label={t("cameraCreate.analyzingDefault")} />}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {CAPTURE_STEPS.map((item) => {
          const StepIcon = STEP_ICONS[item];
          const disabled = working || (item !== "barcode" && !done.barcode) || (item === "barcode" && !!done.barcode);
          return (
            <button
              key={item}
              type="button"
              onClick={() => selectStep(item)}
              disabled={disabled && item !== step}
              aria-current={item === step ? "step" : undefined}
              className="relative flex h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-[8px] px-1 text-center text-hf-black disabled:opacity-50"
              style={{
                background: "var(--hf-color-card)",
                outline: item === step ? "2px solid var(--hf-color-brand)" : undefined,
                outlineOffset: -2,
              }}
            >
              <StepIcon size={20} stroke={1.8} />
              <span className="hf-type-micro">{stepLabels[item]}</span>
              {done[item] && (
                <CaptureCheckOverlay label={t("cameraCreate.stepDone", { step: stepLabels[item] })} size={24} />
              )}
            </button>
          );
        })}
      </div>

      {createFailed ? (
        <div className="flex flex-col items-center gap-2">
          <p className="hf-type-small text-center">{t("cameraCreate.createFailed")}</p>
          <button type="button" onClick={() => void createProduct()} className="hf-control hf-btn-primary px-6">
            {t("cameraCreate.retry")}
          </button>
        </div>
      ) : (
        <>
          <p className="hf-type-small text-text-secondary text-center">{stepHints[step]}</p>
          {step !== "barcode" && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void capturePhoto()}
                disabled={cameraStatus !== "active" || working}
                className="hf-control hf-btn-primary gap-2 px-6 disabled:opacity-40"
              >
                <IconCamera size={19} /> {t("camera.takePhoto")}
              </button>
            </div>
          )}
        </>
      )}

      <Link href={`/foods/new${returnSuffix}`} className="hf-control hf-btn-secondary justify-center">
        {t("camera.addManually")}
      </Link>
    </div>
  );
}
