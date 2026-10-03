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
import { IconBolt, IconBoltOff, IconFlame, IconList, IconPhoto } from "@tabler/icons-react";
import { IconBarcodeCard } from "@/components/icons/BarcodeCard";
import { BarcodeScanOverlay, type BarcodeDetection } from "@/components/hf/BarcodeScanOverlay";
import { CaptureCheckOverlay } from "@/components/hf/CaptureCheckOverlay";
import { PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import { ObjectPickerOverlay } from "@/components/camera/ObjectPickerOverlay";
import { cropToObject, detectObjects, type ObjectBox } from "@/lib/object-picker";
import { ProductOutlineOverlay } from "@/components/camera/ProductOutlineOverlay";
import { LabelFillOverlay } from "@/components/camera/LabelFillOverlay";
import {
  MAX_LABEL_ATTEMPTS,
  countsAsAttempt,
  labelDone,
  labelFound,
  mergeLabelAttempts,
  sharpest,
  type LabelAttempt,
  type LabelNeed,
} from "@/lib/live-scan";
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
import type { LabelRegions } from "@/lib/label-text-regions";
import type { OcrBox } from "@/lib/product-ocr-prioritized";
import {
  CAPTURE_STEPS,
  createQuickProduct,
  readBarcodePhoto,
  readFrontPhoto,
  readLabelPhoto,
  saveBarcodePhoto,
  submitProductRescan,
  type CaptureData,
  type LabelRead,
  type CaptureStep,
} from "@/lib/product-capture";
import type { RescanStep } from "@/lib/product-rescan-offer";
import { useFrameQuality } from "./useFrameQuality";
import {
  BARCODE_FOCUS_DISTANCE_M,
  lockFocusDistance,
  readCameraControls,
  setContinuousFocus,
  setTorch,
  type CameraControls,
} from "@/lib/camera-controls";
import { useLiveFrames, type LiveFrame } from "./useLiveFrames";
import { cameraVideoConstraints, captureStill, captureVideoFrame, type Still, type StillCrop } from "@/lib/camera-still";
import { newScanFlowId, scanFlowHeaders, scanLog } from "@/lib/scan-debug-log";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27, levende scanning
// 2026-10-02). Fire knapper under kameraet — Stregkode, Forside, Energi,
// Indhold — og kameraet starter altid på stregkoden. En kendt stregkode går
// direkte til varen. En ukendt fører videre til forside → energi → indhold.
// Kameraet fryser aldrig: på hvert trin tages der løbende billeder af den
// kørende video, når varen er skarp og stille (useLiveFrames). Forsiden
// bruger det skarpeste af en lille serie; energi og indhold læses billede for
// billede med lokal OCR, og aflæsningerne lægges sammen (src/lib/live-scan.ts),
// indtil feltet er læst sikkert eller ti billeder er brugt. Når et trin er
// klaret, fyldes varens kontur (forside) eller det læste tekstfelt (energi/
// indhold) hvidt oven på videoen, og knappen får flueben. Står indholdet på
// energibilledet, får begge flueben. Så snart alle er klaret, oprettes varen
// (POST /api/products/quick), og skærmen går til /add/[id]; serveren udfylder
// navn/brand/næring/indhold bagefter — energi og indhold fra telefonens egen
// aflæsning, når den er sikker, ellers OpenAI. "Tag billede" er en manuel
// reserve: forsiden tages straks, energi/indhold afsluttes med den bedste
// aflæsning indtil nu.
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
// Er stregkodebilledet stadig uskarpt, skiftes der så ofte mellem
// autofokus og fast fokus på ~20 cm (kun hvor kameraet tillader det).
const BARCODE_FOCUS_TOGGLE_MS = 2500;
const NO_CAMERA_CONTROLS: CameraControls = { torch: false, continuousFocus: false, focusDistance: null };
// Den hvide udfyldning står så længe, før flowet går videre (= .hf-scan-fill).
const FLASH_MS = 1400;
const FLASH_REDUCED_MS = 600;
// Forsiden: det skarpeste af så mange billeder taget lige efter hinanden.
const FRONT_BURST_FRAMES = 3;
const FRONT_BURST_MS = 800;
// Fokus-måleren: forsiden kræver fire stille målinger, etiketterne to.
const FRONT_MIN_PROGRESS = 1;
const LABEL_MIN_PROGRESS = 0.5;
// Den levende scannings videobilleder (lokal OCR): energi/indhold beskæres
// til søgerens kvadrat, forsiden ikke (docs/DECISIONS.md 2026-09-17).
const LIVE_FRAME_MAX_SIDE = 1600;
// Stregkodefotoet tages midt i scanningen og må ikke forsinke den.
const BARCODE_PHOTO_MAX_SIDE = 1920;

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

// Det gemte foto (serverens AI) er et rigtigt stillbillede
// (src/lib/camera-still.ts, docs/DECISIONS.md 2026-10-02); den levende
// scanning afgør kun, hvornår det tages, og hvad telefonen selv læste.
type Frame = { url: string; width: number; height: number };

function liveCrop(step: CaptureStep): StillCrop {
  return step === "front" ? "none" : "square";
}

// Den hvide udfyldning, når et trin er klaret: tekstfeltet (energi/indhold)
// i det læste billedes pixels, eller varens kontur (forside).
type Flash = { kind: "label"; width: number; height: number; boxes: OcrBox[] } | { kind: "object" };

function regionBoxes(regions: LabelRegions, need?: LabelNeed): OcrBox[] {
  const boxes = need === "ingredients" ? [regions.ingredients] : [regions.nutrition, regions.ingredients];
  return boxes.filter((box): box is OcrBox => box !== null);
}

function labelFlash(frame: Frame, regions: LabelRegions, need?: LabelNeed): Flash {
  const boxes = regionBoxes(regions, need);
  return boxes.length ? { kind: "label", width: frame.width, height: frame.height, boxes } : { kind: "object" };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  // Forsidens analyse (objekter, dubletopslag) og oprettelsen: knapperne låses.
  const [working, setWorking] = useState(false);
  // Flere mulige objekter på forsidebilledet: billedet fryses, og brugeren
  // trykker på det rigtige.
  const [pickPhoto, setPickPhoto] = useState<string | null>(null);
  const [pickObjects, setPickObjects] = useState<ObjectBox[] | null>(null);
  const pickResolveRef = useRef<((object: ObjectBox | null) => void) | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const flashRef = useRef(false);
  const barcodeLabelJobRef = useRef<{ frame: Frame; startedAt: number; result: Promise<LabelRead> } | null>(null);
  const [createFailed, setCreateFailed] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [region, setRegion] = useState("DK");
  const [barcodeDetection, setBarcodeDetection] = useState<BarcodeDetection | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);

  // Den levende scanning: ét billede ad gangen er under analyse (busy);
  // runId stiger ved hvert trinskift, så svar fra et forladt trin smides væk.
  const busyRef = useRef(false);
  const runIdRef = useRef(0);
  const frontBurstRef = useRef<{ frames: LiveFrame[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const labelBestRef = useRef<LabelAttempt<LiveFrame> | null>(null);
  const labelAttemptsRef = useRef(0);
  const labelStartedAtRef = useRef(0);
  // "Tag billede" under en igangværende aflæsning: afslut med den bedste.
  const labelForceRef = useRef(false);

  const scanning = step === "barcode" && !done.barcode;
  const [cameraControls, setCameraControls] = useState<CameraControls>(NO_CAMERA_CONTROLS);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    workingRef.current = working;
  }, [working]);

  useEffect(() => {
    flashRef.current = flash !== null;
  }, [flash]);

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
          const track = stream.getVideoTracks()[0];
          const controls = readCameraControls(track);
          if (track) void setContinuousFocus(track, controls);
          setCameraControls(controls);
          setTorchOn(false);
          setCameraStatus("active");
          cameraReadyAtRef.current = Date.now();
          scanLog(flowId, "camera_ready", {
            message: `Kamera klar (${videoRef.current.videoWidth}×${videoRef.current.videoHeight})`,
            durationMs: Date.now() - requestedAt,
            data: {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
              restart: restartKey,
              torch: controls.torch,
              continuousFocus: controls.continuousFocus,
              focusDistance: controls.focusDistance,
            },
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

  // Sprogsignalerne fastfryses ved åbningen, ligesom ved en scannet stregkode.
  useEffect(() => {
    if (rescan && !dataRef.current.languageSignals) dataRef.current.languageSignals = readLanguageSignals(locale);
  }, [rescan, locale]);

  // Nulstiller den levende scanning, når trinnet skifter — svar, der er
  // undervejs fra det gamle trin, ignoreres.
  function resetLiveScan() {
    runIdRef.current += 1;
    busyRef.current = false;
    labelForceRef.current = false;
    labelBestRef.current = null;
    labelAttemptsRef.current = 0;
    labelStartedAtRef.current = 0;
    if (frontBurstRef.current) clearTimeout(frontBurstRef.current.timer);
    frontBurstRef.current = null;
  }

  useEffect(() => () => resetLiveScan(), []);

  function goToNextStep(completed: Partial<Record<CaptureStep, boolean>>) {
    resetLiveScan();
    const next = visibleSteps.find((item) => !completed[item]);
    if (next) {
      setWorking(false);
      setStep(next);
      return;
    }
    void (rescan ? submitRescan() : createProduct());
  }

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

  // Den hvide udfyldning står et øjeblik, og først derefter går flowet videre
  // — også først når `pending` (stillbilledet til serveren) er i hus.
  async function flashThenContinue(
    next: Flash,
    completed: Partial<Record<CaptureStep, boolean>>,
    pending: Promise<unknown> = Promise.resolve(),
  ) {
    setFlash(next);
    flashRef.current = true;
    await Promise.all([wait(reducedMotion() ? FLASH_REDUCED_MS : FLASH_MS), pending.catch(() => {})]);
    if (leavingRef.current) return;
    setFlash(null);
    flashRef.current = false;
    goToNextStep(completed);
  }

  // Stregkodefotoets baggrunds-OCR (docs/DECISIONS.md 2026-09-28): står
  // næringstabellen og/eller ingredienslisten ved stregkoden, får Energi/
  // Indhold flueben; står brugeren på et af de trin, vises tekstfeltet hvidt,
  // og flowet går videre. Trin, som brugeren allerede selv har klaret, røres ikke.
  function applyBarcodeLabel(frame: Frame, result: LabelRead, startedAt: number) {
    if (leavingRef.current) return;
    const data = dataRef.current;
    const already = doneRef.current;
    const nutritionFound = labelFound(result, "nutrition");
    const ingredientsFound = labelFound(result, "ingredients");
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
    // Forsidens analyse eller en udfyldning kører: trinskiftet sker, når den
    // er færdig (goToNextStep springer klarede trin over).
    if (workingRef.current || flashRef.current) return;
    // Står brugeren på et trin, der nu er klaret, går flowet videre — med
    // konturen fyldt hvid (stregkodefotoets bokse passer ikke til det, der
    // ses nu). Er en aflæsning i gang dér, afsluttes den selv (processLabelFrame).
    if (completed[stepRef.current] && !busyRef.current) {
      void flashThenContinue({ kind: "object" }, completed);
    }
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
      lookupTimerRef.current = setTimeout(
        () => {
          lookupTimerRef.current = null;
          void lookupBarcode(code);
        },
        reducedMotion() ? DECODE_ANIMATION_REDUCED_MS : DECODE_ANIMATION_MS,
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

  // Lys/fokus i billedet: hvid tekst på kameraet, når det er for mørkt eller
  // uskarpt (docs/DECISIONS.md 2026-10-02).
  const frameIssue = useFrameQuality(
    videoRef,
    cameraStatus === "active" && !pickPhoto && !working && !flash && !createFailed && !barcodeDetection,
  );
  const frameIssueRef = useRef(frameIssue);
  useEffect(() => {
    frameIssueRef.current = frameIssue;
    if (frameIssue) {
      scanLog(flowId, "frame_issue", {
        level: "warn",
        message: frameIssue === "dark" ? "Billedet er for mørkt" : "Billedet er ude af fokus",
        data: { issue: frameIssue, step: stepRef.current },
      });
    }
  }, [frameIssue, flowId]);

  // Stregkoden holdes ca. 20 cm fra kameraet. Autofokus er standard; er
  // billedet stadig uskarpt, skiftes der mellem fast fokus på 20 cm og
  // autofokus, til koden læses. Andre trin bruger altid autofokus.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!scanning || cameraStatus !== "active" || !track || !cameraControls.focusDistance) return;
    let locked = false;
    const interval = setInterval(() => {
      if (!locked && frameIssueRef.current !== "blurry") return;
      locked = !locked;
      if (locked) {
        void lockFocusDistance(track, cameraControls, BARCODE_FOCUS_DISTANCE_M).then((ok) =>
          scanLog(flowId, "focus_locked", {
            message: ok ? "Fokus låst på ~20 cm til stregkoden" : "Kameraet afviste fast fokus",
            level: ok ? "info" : "warn",
          }),
        );
      } else {
        void setContinuousFocus(track, cameraControls);
      }
    }, BARCODE_FOCUS_TOGGLE_MS);
    return () => {
      clearInterval(interval);
      if (locked && track.readyState === "live") void setContinuousFocus(track, cameraControls);
    };
  }, [scanning, cameraStatus, cameraControls, flowId]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    const ok = await setTorch(track, next);
    if (ok) setTorchOn(next);
    scanLog(flowId, "torch", {
      level: ok ? "info" : "warn",
      message: ok ? (next ? "Lygte tændt" : "Lygte slukket") : "Lygten kunne ikke styres",
      data: { on: next, step: stepRef.current },
    });
  }

  // Ved flere objekter på billedet fryses det med grønne cirkler, og billedet
  // beskæres til det objekt, brugeren trykker på. Ét eller ingen objekt: hele
  // billedet, og kameraet fryser aldrig.
  async function chooseObject(frame: string): Promise<string> {
    const objects = await detectObjects(frame);
    if (objects.length < 2 || leavingRef.current) return frame;
    setWorking(false);
    const picked = await new Promise<ObjectBox | null>((resolve) => {
      pickResolveRef.current = resolve;
      setPickPhoto(frame);
      setPickObjects(objects);
    });
    pickResolveRef.current = null;
    setPickObjects(null);
    setPickPhoto(null);
    setWorking(true);
    if (!picked) return frame;
    return cropToObject(frame, picked);
  }

  // Fotoet til serveren: kameraets stillbillede (ellers det skarpeste af tre
  // videobilleder); fejler det, bruges den levende scannings eget billede.
  async function takeStill(step: CaptureStep, fallback: LiveFrame): Promise<Still> {
    const startedAt = Date.now();
    const still = (await captureStill(videoRef.current, liveCrop(step))) ?? fallback;
    scanLog(flowId, "photo_captured", {
      message: `Foto til trinnet "${step}": ${still === fallback ? "scanningens videobillede" : still.source === "photo" ? "stillbillede" : "videobillede"} ${still.width}×${still.height}, skarphed ${still.sharpness}`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: { step, source: still === fallback ? "live" : still.source, width: still.width, height: still.height, sharpness: still.sharpness },
    });
    return still;
  }

  // Forsiden: når serien er skarp, tages stillbilledet, som analyseres —
  // objekter, dublet-tjek — og varens kontur fyldes hvid, når trinnet er klaret.
  async function processFront(frame: LiveFrame) {
    if (busyRef.current || leavingRef.current) return;
    busyRef.current = true;
    const runId = runIdRef.current;
    setWorking(true);
    const languages = ocrLanguages();
    const data = dataRef.current;
    const startedAt = Date.now();
    const still = await takeStill("front", frame);
    if (leavingRef.current || runId !== runIdRef.current) return;
    const chosen = await chooseObject(still.url);
    if (leavingRef.current || runId !== runIdRef.current) return;
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
      data: { ...front, languages, sharpness: still.sharpness },
    });
    if (leavingRef.current || runId !== runIdRef.current) return;
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
    setWorking(false);
    await flashThenContinue({ kind: "object" }, markDone("front"));
  }

  function closeFrontBurst() {
    const burst = frontBurstRef.current;
    if (!burst) return;
    clearTimeout(burst.timer);
    frontBurstRef.current = null;
    const best = sharpest(burst.frames);
    if (best) void processFront(best);
  }

  // Energi/indhold: hvert billede læses lokalt og lægges sammen med de
  // forrige; trinnet er klaret, når feltet er læst sikkert, når ti billeder
  // med tekst er brugt, eller når brugeren trykker "Tag billede".
  async function processLabelFrame(frame: LiveFrame, force: boolean) {
    const need: LabelNeed = stepRef.current === "ingredients" ? "ingredients" : "nutrition";
    if (busyRef.current) {
      if (force) labelForceRef.current = true;
      return;
    }
    busyRef.current = true;
    if (force) labelForceRef.current = true;
    const runId = runIdRef.current;
    if (!labelStartedAtRef.current) labelStartedAtRef.current = Date.now();
    const startedAt = Date.now();
    const read = await readLabelPhoto(frame.url, ocrLanguages());
    if (leavingRef.current || runId !== runIdRef.current) return;
    busyRef.current = false;
    const best = mergeLabelAttempts(labelBestRef.current, { frame, read }, need);
    labelBestRef.current = best;
    if (countsAsAttempt(read)) labelAttemptsRef.current += 1;
    const attempts = labelAttemptsRef.current;
    scanLog(flowId, "label_attempt", {
      message: `${need === "nutrition" ? "Energi" : "Indhold"}: billede ${attempts}/${MAX_LABEL_ATTEMPTS} læst (${read.text.length} tegn, sikkerhed ${Math.round(read.confidence)} %)`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: {
        attempts,
        textLength: read.text.length,
        confidence: read.confidence,
        sharpness: Math.round(frame.sharpness),
        nutrition: Boolean(read.nutrition),
        ingredients: Boolean(read.ingredientsText),
        nutritionRegion: Boolean(read.regions.nutrition),
        ingredientsRegion: Boolean(read.regions.ingredients),
      },
    });
    // Stregkodefotoets baggrunds-OCR klarede trinnet imens.
    if (doneRef.current[need]) {
      void flashThenContinue(labelFlash(frame, read.regions, need), doneRef.current);
      return;
    }
    const finished = labelForceRef.current || labelDone(best.read, need) || attempts >= MAX_LABEL_ATTEMPTS;
    if (!finished) return;
    labelForceRef.current = false;
    finishLabel(need, best, attempts);
  }

  // Trinnet er klaret: telefonens egen aflæsning gemmes nu, og stillbilledet
  // til serveren tages, mens udfyldningen vises (det erstatter videobilledet).
  function finishLabel(need: LabelNeed, best: LabelAttempt<LiveFrame>, attempts: number) {
    const { frame, read } = best;
    const data = dataRef.current;
    const languages = ocrLanguages();
    const durationMs = Date.now() - labelStartedAtRef.current;
    const stillReady = takeStill(need, frame).then((still) => {
      if (need === "nutrition") {
        data.nutritionPhoto = still.url;
        if (data.ingredientsOnNutritionPhoto) data.ingredientsPhoto = still.url;
      } else {
        data.ingredientsPhoto = still.url;
      }
    });
    if (need === "nutrition") {
      // "Ingredienser" på billedet udløser altid indholds-trinnet — kan listen
      // ikke læses lokalt, læser OpenAI den fra samme billede.
      const ingredientsFound = labelFound(read, "ingredients");
      scanLog(flowId, "nutrition_photo", {
        message: read.nutrition
          ? `Energi læst lokalt efter ${attempts} billede(r) (sikkerhed ${Math.round(read.confidence)} %)${ingredientsFound ? " + ingrediensliste på samme billede" : ""}`
          : `Energi: næringstabellen kunne ikke læses lokalt på ${attempts} billede(r) (${read.text.length} tegn) — AI læser den${ingredientsFound ? " (+ ingrediensliste på samme billede)" : ""}`,
        barcode: data.barcode,
        durationMs,
        data: {
          attempts,
          textLength: read.text.length,
          confidence: read.confidence,
          nutrition: read.nutrition,
          ingredientsOnSamePhoto: ingredientsFound,
          localIngredients: Boolean(read.ingredientsText),
          nutritionRegion: Boolean(read.regions.nutrition),
          ingredientsRegion: Boolean(read.regions.ingredients),
          languages,
        },
      });
      data.nutritionPhoto = frame.url;
      data.nutritionOcrText = read.text;
      data.nutritionOcrConfidence = read.confidence;
      data.localNutrition = read.nutrition;
      data.ingredientsOnNutritionPhoto = ingredientsFound;
      if (ingredientsFound) {
        // Indholdet står ved siden af næringstabellen: begge får flueben.
        data.localIngredientsText = read.ingredientsText ?? undefined;
        void flashThenContinue(labelFlash(frame, read.regions), markDone("nutrition", "ingredients"), stillReady);
      } else {
        void flashThenContinue(labelFlash(frame, read.regions, "nutrition"), markDone("nutrition"), stillReady);
      }
      return;
    }

    const ingredientsText = read.ingredientsText ?? "";
    scanLog(flowId, "ingredients_photo", {
      message: ingredientsText
        ? `Ingredienser læst lokalt efter ${attempts} billede(r) (${ingredientsText.length} tegn, sikkerhed ${Math.round(read.confidence)} %)`
        : `Ingredienser: ingen ingrediensliste fundet lokalt på ${attempts} billede(r) (${read.text.length} tegn) — AI læser den`,
      barcode: data.barcode,
      durationMs,
      data: {
        attempts,
        textLength: read.text.length,
        confidence: read.confidence,
        ingredientsLength: ingredientsText.length,
        ingredientsRegion: Boolean(read.regions.ingredients),
        languages,
      },
    });
    data.ingredientsPhoto = frame.url;
    data.ingredientsOcrText = read.text;
    data.ingredientsOcrConfidence = read.confidence;
    data.ingredientsOnNutritionPhoto = false;
    if (ingredientsText) data.localIngredientsText = ingredientsText;
    void flashThenContinue(labelFlash(frame, read.regions, "ingredients"), markDone("ingredients"), stillReady);
  }

  // Et billede fra den levende scanning: forsiden samler en lille serie og
  // tager det skarpeste; etiketterne læses med det samme.
  function onLiveFrame(frame: LiveFrame) {
    if (stepRef.current === "front") {
      let burst = frontBurstRef.current;
      if (!burst) {
        burst = { frames: [], timer: setTimeout(closeFrontBurst, FRONT_BURST_MS) };
        frontBurstRef.current = burst;
      }
      burst.frames.push(frame);
      if (burst.frames.length >= FRONT_BURST_FRAMES) closeFrontBurst();
      return;
    }
    void processLabelFrame(frame, false);
  }

  // "Tag billede" — manuel reserve: forsiden tages nu; energi/indhold
  // afsluttes med den bedste aflæsning (dette billede medregnet, medmindre
  // et andet allerede er under aflæsning).
  function capturePhoto() {
    if (working || step === "barcode" || flash || pickObjects) return;
    const live = captureVideoFrame(videoRef.current, LIVE_FRAME_MAX_SIDE, liveCrop(step));
    if (!live) {
      scanLog(flowId, "photo_capture_failed", { level: "warn", message: `Intet kamerabillede på trinnet "${step}"`, barcode: dataRef.current.barcode });
      return;
    }
    if (step === "front") {
      if (frontBurstRef.current) clearTimeout(frontBurstRef.current.timer);
      frontBurstRef.current = null;
      void processFront(live);
      return;
    }
    void processLabelFrame(live, true);
  }

  function selectStep(next: CaptureStep) {
    if (working || pickObjects || flash || next === step) return;
    if (!visibleSteps.includes(next)) return;
    // Uden stregkode kan intet andet trin aflæses (sprog/region følger den).
    if (next !== "barcode" && !done.barcode) return;
    if (next === "barcode" && done.barcode) return;
    resetLiveScan();
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
  const stepHeadings: Record<CaptureStep, string> = {
    barcode: t("cameraCreate.scanBarcode"),
    front: t("cameraCreate.scanFront"),
    nutrition: t("cameraCreate.scanNutrition"),
    ingredients: t("cameraCreate.scanIngredients"),
  };
  const liveActive =
    step !== "barcode" && cameraStatus === "active" && !working && !pickObjects && !flash && !createFailed;
  const liveProgress = useLiveFrames(
    videoRef,
    liveActive,
    step === "front" ? FRONT_MIN_PROGRESS : LABEL_MIN_PROGRESS,
    liveCrop(step),
    LIVE_FRAME_MAX_SIDE,
    () => !busyRef.current && !flashRef.current,
    onLiveFrame,
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
  // Scanningsstriben fejer over den levende video på alle fototrin og under
  // oprettelsen — ikke mens brugeren vælger objekt eller udfyldningen vises.
  const sweeping = !scanning && !pickObjects && !flash && cameraStatus === "active" && (step !== "barcode" || working);

  return (
    <div className="flex flex-col gap-4">
      {/* Ingen "Tag billede"-knap (brugerens krav 2026-10-02): billedet tages
          automatisk; et tryk på selve kamerabilledet tager det med det samme. */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black"
        onClick={() => {
          if (step !== "barcode" && cameraStatus === "active" && !working && !pickObjects && !pickPhoto && !flash) {
            void capturePhoto();
          }
        }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          aria-label={t("camera.liveViewAriaLabel")}
        />
        {pickPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pickPhoto} alt={t("camera.photoAlt")} className="absolute inset-0 h-full w-full object-cover" />
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

        {!scanning && !pickPhoto && !flash && (
          <div
            className="pointer-events-none absolute inset-[4%] rounded-[12px] border-2 shadow-[0_0_0_999px_rgba(0,0,0,0.2)] transition-colors"
            style={{ borderColor: liveProgress > 0 ? "var(--hf-color-brand)" : "rgba(255,255,255,0.8)" }}
          >
            <div
              className="absolute bottom-0 left-0 h-1 rounded-full transition-[width]"
              style={{ width: `${liveProgress * 100}%`, background: "var(--hf-color-brand)" }}
            />
          </div>
        )}

        {sweeping && <PhotoWorkingOverlay label={t("cameraCreate.analyzingDefault")} />}

        <ProductOutlineOverlay
          videoRef={videoRef}
          active={!scanning && !pickPhoto && !flash && cameraStatus === "active"}
          fill={flash?.kind === "object"}
          flowId={flowId}
        />

        {frameIssue && !cameraMessage && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center" aria-live="polite">
            <p className="hf-type-small hf-type-strong rounded-[8px] bg-hf-black/60 px-3 py-1.5 text-center text-hf-white">
              {frameIssue === "dark"
                ? cameraControls.torch && !torchOn
                  ? t("camera.qualityDarkTorch")
                  : t("camera.qualityDark")
                : scanning
                  ? t("camera.qualityBlurryBarcode")
                  : t("camera.qualityBlurry")}
            </p>
          </div>
        )}

        {cameraControls.torch && cameraStatus === "active" && !pickPhoto && !working && (
          <button
            type="button"
            onClick={(event) => {
              // Et tryk på kamerabilledet tager billedet — ikke når det er lygten.
              event.stopPropagation();
              void toggleTorch();
            }}
            aria-pressed={torchOn}
            aria-label={torchOn ? t("camera.torchOff") : t("camera.torchOn")}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-hf-white"
            style={{ background: torchOn ? "var(--hf-color-brand)" : "rgba(0,0,0,0.5)" }}
          >
            {torchOn ? <IconBolt size={22} stroke={1.8} /> : <IconBoltOff size={22} stroke={1.8} />}
          </button>
        )}

        {flash?.kind === "label" && (
          <LabelFillOverlay
            width={flash.width}
            height={flash.height}
            boxes={flash.boxes}
            label={t("cameraCreate.labelTextFound")}
          />
        )}
        {flash?.kind === "object" && (
          <span role="status" className="sr-only">
            {t("cameraCreate.frontCaptured")}
          </span>
        )}

        {cameraMessage && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{cameraMessage}</p>
          </div>
        )}

        {pickPhoto && pickObjects && (
          <ObjectPickerOverlay
            photo={pickPhoto}
            objects={pickObjects}
            onPick={(object) => pickResolveRef.current?.(object)}
            onUseWhole={() => pickResolveRef.current?.(null)}
          />
        )}

        {!cameraMessage && !pickObjects && (
          <p className="hf-scan-heading hf-type-body hf-type-strong" aria-live="polite">
            {stepHeadings[step]}
          </p>
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
        </>
      )}
    </div>
  );
}
