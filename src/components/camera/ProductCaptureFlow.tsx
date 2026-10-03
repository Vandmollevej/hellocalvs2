"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCamera, IconFlame, IconList, IconPhoto } from "@tabler/icons-react";
import { IconBarcodeCard } from "@/components/icons/BarcodeCard";
import { BarcodeScanOverlay, type BarcodeDetection } from "@/components/hf/BarcodeScanOverlay";
import { CaptureCheckOverlay } from "@/components/hf/CaptureCheckOverlay";
import { PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import { ObjectPickerOverlay } from "@/components/camera/ObjectPickerOverlay";
import { cropToObject, detectObjects, type ObjectBox } from "@/lib/object-picker";
import { ProductOutlineOverlay } from "@/components/camera/ProductOutlineOverlay";
import {
  barcodeGuideBoxFraction,
  barcodePoseFromPoints,
  orientationFromPose,
  type BarcodeOrientation,
} from "@/lib/barcode-scan";
import { startBarcodeFrameScanner, type BarcodeRead } from "@/lib/barcode-frame-scanner";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { readLanguageSignals } from "@/lib/language-signals";
import { buildFakeBarcodeForRegion } from "@/lib/regions";
import { LabelTextHighlight } from "@/components/hf/LabelTextHighlight";
import type { LabelRegions } from "@/lib/label-text-regions";
import type { OcrBox } from "@/lib/product-ocr-prioritized";
import {
  CAPTURE_STEPS,
  createQuickProduct,
  readBarcodePhoto,
  readFrontPhoto,
  readIngredientsPhoto,
  readNutritionPhoto,
  saveBarcodePhoto,
  submitProductRescan,
  type CaptureData,
  type LabelRead,
  type CaptureStep,
} from "@/lib/product-capture";
import type { RescanStep } from "@/lib/product-rescan-offer";
import { useAutoCapture } from "./useAutoCapture";
import { cameraVideoConstraints, captureStill, captureVideoFrame } from "@/lib/camera-still";
import { newScanFlowId, scanFlowHeaders, scanLog } from "@/lib/scan-debug-log";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27). Fire knapper under
// kameraet — Stregkode, Forside, Energi, Indhold — og kameraet starter altid
// på stregkoden. En kendt stregkode går direkte til varen. En ukendt fører
// videre til forside → energi → indhold; hvert foto får et hvidt overlay med
// load-cirklen, mens den lokale OCR kører, og knappen får flueben, når den er
// klaret. Står indholdet på energifotoet, får begge flueben. Så snart alle er
// klaret, oprettes varen (POST /api/products/quick), og skærmen går til
// /add/[id]; serveren udfylder navn/brand/næring/indhold bagefter — energi og
// indhold fra telefonens egen aflæsning, når den er sikker, ellers OpenAI.
//
// Med `rescan` (docs/DECISIONS.md 2026-10-02, banneret "Optjen 10 points" på
// /add/[id]) er stregkoden kendt: kun de felter, varen mangler, vises
// (forside/energi/indhold eller kun forside), og fotos sendes til
// POST /api/products/[id]/rescan i stedet for at oprette en ny vare.

export type RescanTarget = {
  productId: string;
  barcode: string;
  steps: RescanStep[];
  onSubmitted: () => void;
};

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";

// Decode-animationen i BarcodeScanOverlay (BAR_DRAW_MS + cifre), før opslaget.
const DECODE_ANIMATION_MS = 1300;
const DECODE_ANIMATION_REDUCED_MS = 300;
// En aflæsning uden ny læsning i så lang tid regnes for væk.
const DETECTION_STALE_MS = 1200;

const STEP_ICONS: Record<CaptureStep, ComponentType<{ size?: number; stroke?: number }>> = {
  barcode: IconBarcodeCard,
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

// Fotos tages som rigtige stillbilleder (src/lib/camera-still.ts,
// docs/DECISIONS.md 2026-10-02). Forsiden beskæres ikke (2026-09-17);
// energi og indhold beskæres til det kvadrat, brugeren så i søgeren.
type Frame = { url: string; width: number; height: number };

// Stregkodefotoet tages midt i scanningen og må ikke forsinke den.
const BARCODE_PHOTO_MAX_SIDE = 1920;

// Den grønne ramme om næring/ingredienser vises så længe, før flowet går
// videre (energi-/indholdsfoto) eller forsvinder igen (stregkodefotoet).
const HIGHLIGHT_HOLD_MS = 1100;
const BARCODE_HIGHLIGHT_MS = 1800;

type Highlight = Frame & { boxes: OcrBox[] };

function regionBoxes(regions: LabelRegions): OcrBox[] {
  return [regions.nutrition, regions.ingredients].filter((box): box is OcrBox => box !== null);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ProductCaptureFlow({ returnSuffix, rescan }: { returnSuffix: string; rescan?: RescanTarget }) {
  const { t, locale } = useTranslation();
  const visibleSteps: CaptureStep[] = rescan ? rescan.steps : CAPTURE_STEPS;
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScannerRef = useRef<(() => void) | null>(null);
  const lookupInProgressRef = useRef(false);
  const activeCodeRef = useRef<string | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeSeenAtRef = useRef(0);
  const dataRef = useRef<CaptureData>(rescan ? { barcode: rescan.barcode } : {});
  const leavingRef = useRef(false);
  // Admin "Log" (docs/DECISIONS.md 2026-09-28): ét flow-id pr. åbning af
  // kameraet samler alle trin, telefonens og serverens.
  const [flowId] = useState(newScanFlowId);
  const flowStartedAtRef = useRef(0);
  const cameraReadyAtRef = useRef(0);
  const stepRef = useRef<CaptureStep>(rescan ? rescan.steps[0] : "barcode");

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [step, setStep] = useState<CaptureStep>(rescan ? rescan.steps[0] : "barcode");
  const [done, setDone] = useState<Partial<Record<CaptureStep, boolean>>>(rescan ? { barcode: true } : {});
  // Spejler `done`/`working` til stregkodefotoets baggrunds-OCR, som bliver
  // færdig på et vilkårligt tidspunkt senere i flowet.
  const doneRef = useRef<Partial<Record<CaptureStep, boolean>>>(rescan ? { barcode: true } : {});
  const workingRef = useRef(false);
  // Stillbilledet tager op til et par sekunder — aldrig to ad gangen.
  const capturingRef = useRef(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // Flere mulige objekter på forsidefotoet: brugeren trykker på det rigtige.
  const [pickObjects, setPickObjects] = useState<ObjectBox[] | null>(null);
  const pickResolveRef = useRef<((object: ObjectBox | null) => void) | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeLabelJobRef = useRef<{ frame: Frame; startedAt: number; result: Promise<LabelRead> } | null>(null);
  const [createFailed, setCreateFailed] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [region, setRegion] = useState("DK");
  const [barcodeDetection, setBarcodeDetection] = useState<BarcodeDetection | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);

  const scanning = step === "barcode" && !done.barcode;

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    workingRef.current = working;
  }, [working]);

  function showHighlight(frame: Frame, regions: LabelRegions, durationMs: number | null) {
    const boxes = regionBoxes(regions);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
    if (!boxes.length) {
      setHighlight(null);
      return false;
    }
    setHighlight({ ...frame, boxes });
    if (durationMs !== null) {
      highlightTimerRef.current = setTimeout(() => {
        highlightTimerRef.current = null;
        setHighlight(null);
      }, durationMs);
    }
    return true;
  }

  useEffect(
    () => () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    },
    [],
  );

  // Flowets start og — hvis brugeren går uden at nå en vare — hvor langt
  // hen scanningen kom. Under 0,5 s er React's dobbelte montering i udvikling.
  useEffect(() => {
    const startedAt = Date.now();
    flowStartedAtRef.current = startedAt;
    const leaving = leavingRef;
    const data = dataRef;
    const currentStep = stepRef;
    scanLog(flowId, "flow_start", {
      message: "Kameraflow åbnet",
      data: { userAgent: navigator.userAgent.slice(0, 200), language: navigator.language },
    });
    return () => {
      const durationMs = Date.now() - startedAt;
      if (leaving.current || durationMs < 500) return;
      scanLog(flowId, "flow_abandoned", {
        level: "warn",
        message: `Forladt uden vare på trinnet "${currentStep.current}"`,
        barcode: data.current.barcode,
        durationMs,
        data: { step: currentStep.current },
      });
    };
  }, [flowId]);

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
        scanLog(flowId, "camera_failed", { level: "error", message: "Kamera ikke tilgængeligt i browseren" });
        return;
      }
      const requestedAt = Date.now();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: cameraVideoConstraints(),
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (!cancelled) {
          setCameraStatus("active");
          cameraReadyAtRef.current = Date.now();
          scanLog(flowId, "camera_ready", {
            message: `Kamera klar (${videoRef.current.videoWidth}×${videoRef.current.videoHeight})`,
            durationMs: Date.now() - requestedAt,
            data: { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight, restart: restartKey },
          });
        }
      } catch (error) {
        if (!cancelled) {
          const status = statusFromCameraError(error);
          setCameraStatus(status);
          scanLog(flowId, "camera_failed", {
            level: "error",
            message: `Kamera kunne ikke starte (${status})`,
            data: { status, name: error instanceof DOMException ? error.name : null, error: String(error).slice(0, 300) },
          });
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [restartKey, stopCamera, flowId]);

  function goToNextStep(completed: Partial<Record<CaptureStep, boolean>>) {
    const next = visibleSteps.find((item) => !completed[item]);
    if (next) {
      setPhoto(null);
      setWorking(false);
      setStep(next);
      return;
    }
    void (rescan ? submitRescan() : createProduct());
  }

  // Sprogsignalerne fastfryses ved åbningen, ligesom ved en scannet stregkode.
  useEffect(() => {
    if (rescan && !dataRef.current.languageSignals) dataRef.current.languageSignals = readLanguageSignals(locale);
  }, [rescan, locale]);

  async function submitRescan() {
    if (!rescan) return;
    setWorking(true);
    setCreateFailed(false);
    const startedAt = Date.now();
    try {
      await submitProductRescan(rescan.productId, { ...dataRef.current, flowId }, marketRegion());
      scanLog(flowId, "flow_done", {
        message: "Genscanning sendt — AI læser fotos i baggrunden",
        barcode: rescan.barcode,
        productId: rescan.productId,
        durationMs: Date.now() - flowStartedAtRef.current,
        data: { outcome: "rescan", steps: rescan.steps, submitMs: Date.now() - startedAt },
      });
      leavingRef.current = true;
      stopCamera();
      rescan.onSubmitted();
    } catch (error) {
      scanLog(flowId, "rescan_failed", {
        level: "error",
        message: `Genscanningen kunne ikke sendes: ${String(error).slice(0, 200)}`,
        barcode: rescan.barcode,
        productId: rescan.productId,
        durationMs: Date.now() - startedAt,
      });
      setWorking(false);
      setCreateFailed(true);
    }
  }

  function markDone(...steps: CaptureStep[]) {
    const completed = { ...doneRef.current, ...Object.fromEntries(steps.map((item) => [item, true])) };
    doneRef.current = completed;
    setDone(completed);
    return completed;
  }

  // Stregkodefotoets baggrunds-OCR (docs/DECISIONS.md 2026-09-28): står
  // næringstabellen og/eller ingredienslisten ved stregkoden, får Energi/
  // Indhold flueben, og fotoet vises kort med den grønne ramme. Trin, som
  // brugeren allerede selv har fotograferet, røres ikke.
  function applyBarcodeLabel(frame: Frame, result: LabelRead, startedAt: number) {
    if (leavingRef.current) return;
    const data = dataRef.current;
    const already = doneRef.current;
    const nutritionFound = Boolean(result.nutrition || result.regions.nutrition);
    const ingredientsFound = Boolean(result.ingredientsText || result.regions.ingredients);
    const fillNutrition = nutritionFound && !already.nutrition;
    const fillIngredients = ingredientsFound && !already.ingredients;
    scanLog(flowId, "barcode_label", {
      message:
        nutritionFound || ingredientsFound
          ? `Stregkodefotoet: ${[nutritionFound && "næringstabel", ingredientsFound && "ingrediensliste"].filter(Boolean).join(" + ")} fundet${fillNutrition || fillIngredients ? "" : " (trinnene var allerede klaret)"}`
          : `Stregkodefotoet: hverken næringstabel eller ingrediensliste fundet (${result.text.length} tegn)`,
      barcode: data.barcode,
      durationMs: Date.now() - startedAt,
      data: {
        textLength: result.text.length,
        confidence: result.confidence,
        nutritionRegion: Boolean(result.regions.nutrition),
        ingredientsRegion: Boolean(result.regions.ingredients),
        localNutrition: Boolean(result.nutrition),
        localIngredients: Boolean(result.ingredientsText),
        filled: [fillNutrition && "nutrition", fillIngredients && "ingredients"].filter(Boolean),
      },
    });
    if (!fillNutrition && !fillIngredients) return;

    if (fillNutrition) {
      data.nutritionPhoto = frame.url;
      data.nutritionOcrText = result.text;
      data.nutritionOcrConfidence = result.confidence;
      data.localNutrition = result.nutrition;
      data.ingredientsOnNutritionPhoto = fillIngredients;
    }
    if (fillIngredients) {
      // Også som eget indholdsfoto, hvis energifotoet senere tages om.
      data.ingredientsPhoto = frame.url;
      data.ingredientsOcrText = result.text;
      data.ingredientsOcrConfidence = result.confidence;
      if (result.ingredientsText) data.localIngredientsText = result.ingredientsText;
    }
    const steps: CaptureStep[] = [];
    if (fillNutrition) steps.push("nutrition");
    if (fillIngredients) steps.push("ingredients");
    const completed = markDone(...steps);
    if (workingRef.current) return;
    showHighlight(frame, result.regions, BARCODE_HIGHLIGHT_MS);
    // Stod brugeren på et trin, der nu er klaret, går flowet videre.
    if (completed[stepRef.current]) goToNextStep(completed);
  }

  async function createProduct() {
    setWorking(true);
    setCreateFailed(false);
    const startedAt = Date.now();
    const barcode = dataRef.current.barcode;
    try {
      const id = await createQuickProduct({ ...dataRef.current, flowId }, marketRegion());
      scanLog(flowId, "flow_done", {
        message: "Vare oprettet — går til varen (AI udfylder resten i baggrunden)",
        barcode,
        productId: id,
        durationMs: Date.now() - flowStartedAtRef.current,
        data: { outcome: "created", createMs: Date.now() - startedAt },
      });
      leaveTo(`/add/${id}${returnSuffix}`);
    } catch (error) {
      scanLog(flowId, "product_create_failed", {
        level: "error",
        message: `Oprettelsen fejlede: ${String(error).slice(0, 200)}`,
        barcode,
        durationMs: Date.now() - startedAt,
      });
      setWorking(false);
      setCreateFailed(true);
    }
  }

  function marketRegion() {
    return buildBarcodeContext(dataRef.current.barcode ?? "", region).marketRegion;
  }

  // Region + stregkode + telefonens land/sprog + appens sprog (fastfrosset
  // ved scanningen). Tesseract får kun de første sprog (hastighed).
  function ocrLanguages() {
    return buildBarcodeContext(dataRef.current.barcode ?? "", region, dataRef.current.languageSignals)
      .tesseractLanguages;
  }

  const lookupBarcode = useCallback(
    async (code: string) => {
      if (lookupInProgressRef.current) return;
      lookupInProgressRef.current = true;
      setLookupError(false);
      const startedAt = Date.now();
      try {
        const response = await fetch(`/api/products/lookup/${encodeURIComponent(code)}`, {
          headers: scanFlowHeaders(flowId),
        });
        if (response.ok) {
          const data = (await response.json()) as { product: { id: string }; source?: string };
          scanLog(flowId, "flow_done", {
            message: `Kendt stregkode (${data.source ?? "ukendt kilde"}) — går direkte til varen`,
            barcode: code,
            productId: data.product.id,
            durationMs: Date.now() - flowStartedAtRef.current,
            data: { outcome: "existing", source: data.source ?? null, lookupMs: Date.now() - startedAt },
          });
          leaveTo(`/add/${data.product.id}${returnSuffix}`);
          return;
        }
        if (response.status !== 404) throw new Error(`Product lookup failed (${response.status})`);

        // Ukendt vare: gem stregkoden og gå videre til forsiden.
        const frame = captureVideoFrame(videoRef.current, BARCODE_PHOTO_MAX_SIDE);
        dataRef.current.barcode = code;
        dataRef.current.languageSignals = readLanguageSignals(locale);
        const context = buildBarcodeContext(code, region, dataRef.current.languageSignals);
        if (frame) {
          void saveBarcodePhoto(frame.url, code, context.marketRegion, context.signals, flowId).then((id) => {
            if (id) dataRef.current.barcodeAnalysisId = id;
            else scanLog(flowId, "barcode_photo_failed", { level: "warn", message: "Stregkode-fotoet blev ikke gemt", barcode: code });
          });
          // Næring/ingredienser ved stregkoden læses i baggrunden fra samme
          // foto, mens brugeren går videre til forsiden.
          barcodeLabelJobRef.current = {
            frame,
            startedAt: Date.now(),
            result: readBarcodePhoto(frame.url, context.tesseractLanguages),
          };
        } else {
          scanLog(flowId, "barcode_photo_failed", { level: "warn", message: "Intet kamerabillede til stregkode-fotoet", barcode: code });
        }
        stopScanner();
        setBarcodeDetection(null);
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
        doneRef.current = { ...doneRef.current, barcode: true };
        setDone(doneRef.current);
        setStep("front");
      } catch (error) {
        scanLog(flowId, "barcode_lookup_error", {
          level: "error",
          message: `Stregkodeopslaget fejlede: ${String(error).slice(0, 200)}`,
          barcode: code,
          durationMs: Date.now() - startedAt,
        });
        setLookupError(true);
        setBarcodeDetection(null);
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
      }
    },
    [flowId, leaveTo, locale, region, returnSuffix, stopScanner],
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
      scanLog(flowId, "barcode_read", {
        message: `Stregkode aflæst (${symbology})`,
        barcode: code,
        durationMs: cameraReadyAtRef.current ? Date.now() - cameraReadyAtRef.current : null,
        data: { symbology, orientation },
      });
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lookupTimerRef.current = setTimeout(
        () => {
          lookupTimerRef.current = null;
          void lookupBarcode(code);
        },
        reducedMotion ? DECODE_ANIMATION_REDUCED_MS : DECODE_ANIMATION_MS,
      );
    },
    [flowId, lookupBarcode],
  );
  const handleBarcodeReadRef = useRef(handleBarcodeRead);
  useEffect(() => {
    handleBarcodeReadRef.current = handleBarcodeRead;
  }, [handleBarcodeRead]);

  const onBarcodeLabel = useEffectEvent((frame: Frame, result: LabelRead, startedAt: number) =>
    applyBarcodeLabel(frame, result, startedAt),
  );

  // Stregkodefotoets aflæsning startes i opslaget og afleveres her, når den
  // er færdig — også hvis brugeren er nået længere i flowet.
  useEffect(() => {
    const job = barcodeLabelJobRef.current;
    if (!done.barcode || !job) return;
    barcodeLabelJobRef.current = null;
    void job.result.then((result) => onBarcodeLabel(job.frame, result, job.startedAt));
  }, [done.barcode]);

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

  // Ved flere objekter på billedet vises grønne cirkler, og billedet beskæres
  // til det objekt, brugeren trykker på. Ét eller ingen objekt: hele billedet.
  async function chooseObject(frame: string): Promise<string> {
    const objects = await detectObjects(frame);
    if (objects.length < 2 || leavingRef.current) return frame;
    setWorking(false);
    const picked = await new Promise<ObjectBox | null>((resolve) => {
      pickResolveRef.current = resolve;
      setPickObjects(objects);
    });
    pickResolveRef.current = null;
    setPickObjects(null);
    setWorking(true);
    if (!picked) return frame;
    const cropped = await cropToObject(frame, picked);
    setPhoto(cropped);
    return cropped;
  }

  const capturePhotoRef = useRef(capturePhoto);
  useEffect(() => {
    capturePhotoRef.current = capturePhoto;
  });
  // Energi-/indholdsfotoet: står næring/ingredienser på fotoet, vises det
  // kort med den grønne ramme, før flowet går videre.
  async function holdHighlight(frame: Frame, regions: LabelRegions) {
    if (!showHighlight(frame, regions, null)) return;
    await wait(HIGHLIGHT_HOLD_MS);
    setHighlight(null);
  }

  async function capturePhoto() {
    if (working || capturingRef.current || step === "barcode") return;
    capturingRef.current = true;
    setWorking(true);
    const captureStartedAt = Date.now();
    const frame = await captureStill(videoRef.current, step === "front" ? "none" : "square");
    capturingRef.current = false;
    if (leavingRef.current) return;
    if (!frame) {
      setWorking(false);
      scanLog(flowId, "photo_capture_failed", { level: "warn", message: `Intet kamerabillede på trinnet "${step}"`, barcode: dataRef.current.barcode });
      return;
    }
    scanLog(flowId, "photo_captured", {
      message: `Foto taget på trinnet "${step}": ${frame.source === "photo" ? "stillbillede" : "videobillede"} ${frame.width}×${frame.height}, skarphed ${frame.sharpness}`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - captureStartedAt,
      data: { step, source: frame.source, width: frame.width, height: frame.height, sharpness: frame.sharpness },
    });
    showHighlight(frame, { nutrition: null, ingredients: null }, null);
    setPhoto(frame.url);
    const languages = ocrLanguages();
    const data = dataRef.current;
    const startedAt = Date.now();

    if (step === "front") {
      const chosen = await chooseObject(frame.url);
      if (leavingRef.current) return;
      data.frontPhoto = chosen;
      const front = await readFrontPhoto(chosen, languages, flowId);
      scanLog(flowId, "front_photo", {
        level: front.lookupFailed ? "warn" : "info",
        message: front.textLength
          ? `Forside læst lokalt (${front.textLength} tegn, sikkerhed ${Math.round(front.confidence)} %)${front.duplicateId ? " — dublet fundet" : ""}`
          : "Forside: ingen læsbar tekst lokalt (AI læser den efter oprettelse)",
        barcode: data.barcode,
        productId: front.duplicateId,
        durationMs: Date.now() - startedAt,
        data: { ...front, languages },
      });
      if (leavingRef.current) return;
      // Ved en genscanning er "dubletten" netop varen selv.
      if (front.duplicateId && !rescan) {
        scanLog(flowId, "flow_done", {
          message: "Forsideteksten matcher en eksisterende vare — går til den",
          barcode: data.barcode,
          productId: front.duplicateId,
          durationMs: Date.now() - flowStartedAtRef.current,
          data: { outcome: "duplicate" },
        });
        leaveTo(`/add/${front.duplicateId}${returnSuffix}`);
        return;
      }
      goToNextStep(markDone("front"));
      return;
    }

    if (step === "nutrition") {
      const result = await readNutritionPhoto(frame.url, languages);
      // "Ingredienser" på fotoet udløser altid indholds-trinnet — kan listen
      // ikke læses lokalt, læser OpenAI den fra samme foto.
      const ingredientsFound = Boolean(result.ingredientsText || result.regions.ingredients);
      scanLog(flowId, "nutrition_photo", {
        message: result.nutrition
          ? `Energi læst lokalt (sikkerhed ${Math.round(result.confidence)} %)${ingredientsFound ? " + ingrediensliste på samme foto" : ""}`
          : `Energi: næringstabellen kunne ikke læses lokalt (${result.text.length} tegn) — AI læser den${ingredientsFound ? " (+ ingrediensliste på samme foto)" : ""}`,
        barcode: data.barcode,
        durationMs: Date.now() - startedAt,
        data: {
          textLength: result.text.length,
          confidence: result.confidence,
          nutrition: result.nutrition,
          ingredientsOnSamePhoto: ingredientsFound,
          localIngredients: Boolean(result.ingredientsText),
          nutritionRegion: Boolean(result.regions.nutrition),
          ingredientsRegion: Boolean(result.regions.ingredients),
          languages,
        },
      });
      if (leavingRef.current) return;
      data.nutritionPhoto = frame.url;
      data.nutritionOcrText = result.text;
      data.nutritionOcrConfidence = result.confidence;
      data.localNutrition = result.nutrition;
      await holdHighlight(frame, result.regions);
      if (leavingRef.current) return;
      if (ingredientsFound) {
        // Indholdet står ved siden af næringstabellen: begge får flueben.
        data.ingredientsOnNutritionPhoto = true;
        data.localIngredientsText = result.ingredientsText ?? undefined;
        goToNextStep(markDone("nutrition", "ingredients"));
      } else {
        data.ingredientsOnNutritionPhoto = false;
        goToNextStep(markDone("nutrition"));
      }
      return;
    }

    const result = await readIngredientsPhoto(frame.url, languages);
    scanLog(flowId, "ingredients_photo", {
      message: result.ingredientsText
        ? `Ingredienser læst lokalt (${result.ingredientsText.length} tegn, sikkerhed ${Math.round(result.confidence)} %)`
        : `Ingredienser: ingen ingrediensliste fundet lokalt (${result.text.length} tegn) — AI læser den`,
      barcode: data.barcode,
      durationMs: Date.now() - startedAt,
      data: {
        textLength: result.text.length,
        confidence: result.confidence,
        ingredientsLength: result.ingredientsText.length,
        ingredientsRegion: Boolean(result.regions.ingredients),
        languages,
      },
    });
    if (leavingRef.current) return;
    data.ingredientsPhoto = frame.url;
    data.ingredientsOcrText = result.text;
    data.ingredientsOcrConfidence = result.confidence;
    data.ingredientsOnNutritionPhoto = false;
    if (result.ingredientsText) data.localIngredientsText = result.ingredientsText;
    await holdHighlight(frame, { nutrition: null, ingredients: result.regions.ingredients });
    if (leavingRef.current) return;
    goToNextStep(markDone("ingredients"));
  }

  function selectStep(next: CaptureStep) {
    if (working || pickObjects || next === step) return;
    if (!visibleSteps.includes(next)) return;
    // Uden stregkode kan intet andet trin aflæses (sprog/region følger den).
    if (next !== "barcode" && !done.barcode) return;
    if (next === "barcode" && done.barcode) return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = null;
    setHighlight(null);
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
  const autoCaptureProgress = useAutoCapture(
    videoRef,
    step !== "barcode" && cameraStatus === "active" && !working && !pickObjects && !photo && !highlight && !createFailed,
    () => void capturePhotoRef.current(),
  );

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
          <img
            src={photo}
            alt={t("camera.photoAlt")}
            className={`absolute inset-0 h-full w-full object-cover ${working ? "hf-scan-lift" : ""}`}
          />
        )}

        {scanning && (
          <BarcodeScanOverlay
            guideBox={barcodeGuideBox}
            orientation={barcodeOrientation}
            fakeCode={fakeBarcode}
            detection={barcodeDetection}
            hintText={null}
            holdStillText={t("camera.holdStill")}
          />
        )}

        {!scanning && !photo && (
          <div
            className="pointer-events-none absolute inset-[12%] rounded-[12px] border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.2)] transition-colors"
            style={{ borderColor: autoCaptureProgress > 0 ? "var(--hf-color-brand)" : "rgba(255,255,255,0.8)" }}
          >
            <div
              className="absolute bottom-0 left-0 h-1 rounded-full transition-[width]"
              style={{ width: `${autoCaptureProgress * 100}%`, background: "var(--hf-color-brand)" }}
            />
          </div>
        )}

        <ProductOutlineOverlay
          videoRef={videoRef}
          active={!scanning && !photo && !highlight && !working && cameraStatus === "active"}
          flowId={flowId}
        />

        {cameraMessage && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{cameraMessage}</p>
          </div>
        )}

        {photo && pickObjects && (
          <ObjectPickerOverlay
            photo={photo}
            objects={pickObjects}
            onPick={(object) => pickResolveRef.current?.(object)}
            onUseWhole={() => pickResolveRef.current?.(null)}
          />
        )}
        {working && <PhotoWorkingOverlay label={t("cameraCreate.analyzingDefault")} />}

        {highlight && (
          <LabelTextHighlight
            photo={highlight.url}
            width={highlight.width}
            height={highlight.height}
            boxes={highlight.boxes}
            label={t("cameraCreate.labelTextFound")}
          />
        )}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}
      >
        {visibleSteps.map((item) => {
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
          <p className="hf-type-small text-center">{t(rescan ? "rescan.submitFailed" : "cameraCreate.createFailed")}</p>
          <button
            type="button"
            onClick={() => void (rescan ? submitRescan() : createProduct())}
            className="hf-control hf-btn-primary px-6"
          >
            {t("cameraCreate.retry")}
          </button>
        </div>
      ) : (
        <>
          <p className="hf-type-small text-text-secondary text-center">{stepHints[step]}</p>
          {step !== "barcode" && (
            <p className="hf-type-micro text-text-secondary text-center">{t("camera.autoCaptureHint")}</p>
          )}
          {step !== "barcode" && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void capturePhoto()}
                disabled={cameraStatus !== "active" || working || !!pickObjects}
                className="hf-control hf-btn-primary gap-2 px-6 disabled:opacity-40"
              >
                <IconCamera size={19} /> {t("camera.takePhoto")}
              </button>
            </div>
          )}
        </>
      )}

      {!rescan && (
        <Link href={`/foods/new${returnSuffix}`} className="hf-control hf-btn-secondary justify-center">
          {t("camera.addManually")}
        </Link>
      )}
    </div>
  );
}
