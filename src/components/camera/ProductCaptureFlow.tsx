"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { IconBolt, IconBoltOff, IconFlame, IconList, IconPhoto } from "@tabler/icons-react";
import { IconBarcodeCard } from "@/components/icons/BarcodeCard";
import { BarcodeScanOverlay, type BarcodeDetection } from "@/components/hf/BarcodeScanOverlay";
import { CaptureCheckOverlay } from "@/components/hf/CaptureCheckOverlay";
import { HfLoader, PhotoWorkingOverlay } from "@/components/hf/HfLoader";
import { detectObjects, pickObjectInFocus, type ObjectBox } from "@/lib/object-picker";
import { ProductOutlineOverlay } from "@/components/camera/ProductOutlineOverlay";
import { LabelFillOverlay } from "@/components/camera/LabelFillOverlay";
import { ScanHeading } from "@/components/camera/ScanHeading";
import { StepDoneOverlay } from "@/components/camera/StepDoneOverlay";
import { useCameraWatchdog } from "@/components/camera/useCameraWatchdog";
import { countsAsAttempt, labelFound, mergeLabelAttempts, type LabelAttempt, type LabelNeed } from "@/lib/live-scan";
import {
  barcodeGuideBoxFraction,
  barcodePoseFromPoints,
  orientationFromPose,
  type BarcodeOrientation,
} from "@/lib/barcode-scan";
import { startBarcodeFrameScanner, type BarcodeRead } from "@/lib/barcode-frame-scanner";
import { recordBarcodeSighting, type BarcodeSighting } from "@/lib/barcode-confirm";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { readLanguageSignals } from "@/lib/language-signals";
import type { RescanStep } from "@/lib/product-rescan-offer";
import { buildFakeBarcodeForRegion } from "@/lib/regions";
import type { LabelRegions } from "@/lib/label-text-regions";
import type { OcrBox } from "@/lib/product-ocr-prioritized";
import {
  CAPTURE_STEPS,
  submitProductRescan,
  submitProductQualityCheck,
  createQuickProduct,
  findCreatedProduct,
  recordProductScan,
  readEnergyPhoto,
  readFrontPhoto,
  readLabelPhoto,
  saveBarcodePhoto,
  uploadBackPhoto,
  type CaptureData,
  type CaptureStep,
  type FrontRead,
  type LabelRead,
} from "@/lib/product-capture";
import { useFrameQuality } from "./useFrameQuality";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  BARCODE_FOCUS_DISTANCE_M,
  lockFocusDistance,
  readCameraControls,
  setContinuousFocus,
  setScanExposure,
  setTorch,
  type CameraControls,
} from "@/lib/camera-controls";
import { useLiveFrames, type LiveFrame } from "./useLiveFrames";
import {
  cameraVideoConstraints,
  captureStill,
  captureStillWithFull,
  captureVideoFrame,
  stillPhotoSupported,
  type Still,
  type StillCrop,
} from "@/lib/camera-still";
import { newScanFlowId, scanFlowHeaders, scanLog, scanLogPhoto } from "@/lib/scan-debug-log";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kameraflowet under Tilføj (docs/DECISIONS.md 2026-09-27; "gammeldags
// billede" 2026-10-14). Fire knapper under kameraet — Stregkode, Forside,
// Energi, Indhold — og kameraet starter altid på stregkoden, som læses
// levende af videoen som hidtil. En kendt stregkode går direkte til varen. En
// ukendt fører videre til forside → energi → indhold, hvor brugeren selv
// trykker på udløseren nederst i kamerabilledet (ingen automatisk billede,
// brugerens krav 2026-10-14: "Jeg har ikke tillid til den anden metode").
// Mens brugeren sigter, forlæser telefonen teksten i videoen (forsidens tekst
// og mærke, næringstabel, ingrediensliste) og viser fundene i billedet
// (2026-10-15). Udløseren tager fotoet i trykøjeblikket, og trinnet er klaret
// med det samme: forlæsningen bruges, ellers læses udløserens billede, mens
// "trinnet er klaret" står, og trinnets knap viser "Behandles …", til
// billedet er behandlet (energi/indhold: hele billedet uploadet til nattens
// engangsanalyse). Står indholdet på
// energibilledet, klares begge trin. Indholds-trinnet har "Spring over" til
// højre for udløseren (varer uden indholdsfortegnelse). Når et trin er
// klaret, blinker billedet hvidt, trinnet streges over med et stort flueben
// (StepDoneOverlay), og knappen får flueben. Så snart alle er klaret, oprettes
// varen (POST /api/products/quick), og skærmen går til /add/[id]; serveren
// udfylder navn/brand/næring/indhold bagefter, og varesiden viser felterne
// løbende, som de bliver læst (AddProductView poller Product.pendingFields).

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
// "Trinnet er klaret"-visningen (StepDoneOverlay = .hf-step-done i globals.css):
// blink, overstregning, flueben, og linjen flyver op. Flowet går først videre bagefter.
const STEP_DONE_MS = 1600;
const STEP_DONE_REDUCED_MS = 600;
// Søgefeltet pr. trin (brugerens krav 2026-10-14): forsiden får hele rammen
// (92 %), energi og indhold et mindre felt med resten af billedet mørkt —
// fotoet tages stadig af hele søgerens kvadrat; feltet viser kun, hvad der
// skal holdes i midten. Stregkodens felt ligger i BarcodeScanOverlay.
// Energi/indhold-feltet (60 %, brugeren bad om mindre + mere overlay samme
// dag) står lidt under midten, så den store overskrift øverst ikke dækker det.
const GUIDE_INSET: Record<Exclude<CaptureStep, "barcode">, string> = { front: "4%", nutrition: "24% 20% 16%", ingredients: "24% 20% 16%" };
const GUIDE_DIM: Record<Exclude<CaptureStep, "barcode">, number> = { front: 0.2, nutrition: 0.65, ingredients: 0.65 };
// Fejlede tekstlæsninger i træk på energi/indhold: hvert femte logges.
const LABEL_LOG_EVERY = 5;
// Billedet til den lokale OCR (forlæsningen og udløserens videobillede):
// beskæres til søgerens kvadrat på alle trin (docs/DECISIONS.md 2026-10-15).
const LIVE_FRAME_MAX_SIDE = 1600;
// Forlæsningen (docs/DECISIONS.md 2026-10-15): et billede læses, når videoen
// har været skarp og stille i to målinger, og der holdes så lang en pause
// mellem to aflæsninger, så video og udløser ikke hakker.
const PRE_READ_MIN_PROGRESS = 0.5;
const PRE_READ_GAP_MS = 600;
// Så længe efter sidste fund bruges forlæsningen af udløseren.
const PRE_READ_FRESH_MS = 5000;
// Efter udløseren ventes højst så længe på aflæsningen (mens "trinnet er
// klaret" står); svar, der kommer senere, gemmes blot til oprettelsen.
const SHUTTER_ANALYSIS_WAIT_MS = 2500;
// Energi-trinnet: så længe ventes der på telefonens egen aflæsning, før
// AI'en læser fotoet (docs/DECISIONS.md 2026-10-16).
const ENERGY_LOCAL_WAIT_MS = 4000;
// Oprettelsen venter højst så længe på billeder, der stadig behandles.
const PENDING_PHOTOS_WAIT_MS = 10000;
// Stregkodefotoet tages midt i scanningen og må ikke forsinke den.
const BARCODE_PHOTO_MAX_SIDE = 1920;
// Originalbilleder: hele kamerabilledet op til sensorens opløsning.
const ORIGINAL_MAX_SIDE = 4096;

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

// Alle fotos er præcis det kvadrat, brugeren så i søgeren (docs/DECISIONS.md
// 2026-10-15, "forsidefotoet = søgerens kvadrat"). Hele 9:16-rammen fik
// varen til at se langt væk ud og gav færre pixels til teksten.
const PHOTO_CROP: StillCrop = "square";

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

// Forlæsningen pr. trin: det bedste fund indtil nu og hvornår der sidst blev
// læst tekst. Visningen er det, kamerabilledet skriver.
type FrontPreRead = { at: number; read: FrontRead; reads: number };
type LabelPreRead = { at: number; attempt: LabelAttempt<LiveFrame> | null; reads: number };
type PreReadView = {
  reads: number;
  textFound: boolean;
  brand: string | null;
  duplicate: string | null;
  nutrition: boolean;
  ingredients: boolean;
};
const EMPTY_PRE_READ: PreReadView = { reads: 0, textFound: false, brand: null, duplicate: null, nutrition: false, ingredients: false };
const EMPTY_LABEL_READ: LabelRead = { text: "", confidence: 0, regions: { nutrition: null, ingredients: null }, nutrition: null, ingredientsText: null };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

export function ProductCaptureFlow({ returnSuffix, rescan }: { returnSuffix: string; rescan?: RescanTarget }) {
  const visibleSteps: CaptureStep[] = rescan ? rescan.steps : CAPTURE_STEPS;
  const { t, locale } = useTranslation();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopScannerRef = useRef<(() => void) | null>(null);
  const lookupInProgressRef = useRef(false);
  const activeCodeRef = useRef<string | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBarcodeSeenAtRef = useRef(0);
  const barcodeSightingsRef = useRef<BarcodeSighting[]>([]);
  const dataRef = useRef<CaptureData>(rescan ? { barcode: rescan.barcode } : {});
  // 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15): stregkoden er kendt,
  // men varen er over to år gammel og fremstår som ny — fotoene tages som ved
  // en ny vare og gemmes til nattens vurdering; kunden får varen bagefter.
  const qualityCheckProductIdRef = useRef<string | null>(null);
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
  // Energi-trinnet venter på en gyldig aflæsning (brugerens krav 2026-10-16):
  // "reading" mens AI'en læser fotoet; en fejl står, til billedet tages om.
  const [energyReading, setEnergyReading] = useState(false);
  const [energyError, setEnergyError] = useState<"unreadable" | "ai_unavailable" | "error" | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  // De trin, der netop er klaret (StepDoneOverlay), og det senest klarede
  // (den lille overstregede linje over overskriften).
  const [stepDone, setStepDone] = useState<CaptureStep[] | null>(null);
  const flashRef = useRef(false);
  // Stregkoden er læst, men varen er ukendt: trinnet klares med visningen,
  // før flowet går til forsiden (kaldes fra opslaget via en ref, så
  // useCallback ikke afhænger af flowets funktioner).
  const afterUnknownBarcodeRef = useRef<() => void>(() => {});
  const [createFailed, setCreateFailed] = useState(false);
  // Varen oprettes/genscanningen sendes (bruger 2026-10-14: "stuck", sort
  // kamera, siden reagerede ikke): kameraet og al billedanalyse slukkes, så
  // telefonen kun uploader, og forsiden står bag "Opretter varen …".
  const [submitting, setSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const online = useOnlineStatus();
  // Dyrefoder-spærring: serverens besked, når stregkoden er på spærrelisten.
  const [lookupBlockedMessage, setLookupBlockedMessage] = useState<string | null>(null);
  const [region, setRegion] = useState("DK");
  const [barcodeDetection, setBarcodeDetection] = useState<BarcodeDetection | null>(null);
  const [barcodeOrientation, setBarcodeOrientation] = useState<BarcodeOrientation>("horizontal");
  const barcodeGuideBox = useMemo(() => barcodeGuideBoxFraction(barcodeOrientation), [barcodeOrientation]);
  const fakeBarcode = useMemo(() => buildFakeBarcodeForRegion(region), [region]);

  // runId stiger ved hvert trinskift, så forlæsninger fra et forladt trin
  // smides væk. Én forlæsning ad gangen (preReadBusy).
  const runIdRef = useRef(0);
  const preReadBusyRef = useRef(false);
  const preReadNextAtRef = useRef(0);
  const frontPreReadRef = useRef<FrontPreRead | null>(null);
  const labelPreReadRef = useRef<LabelPreRead | null>(null);
  const [preRead, setPreRead] = useState<PreReadView>(EMPTY_PRE_READ);
  // Fejlede tekstlæsninger i træk på energi/indhold.
  const labelFailuresRef = useRef(0);
  // Udløserens tryk pr. trin: svar fra et billede, der er taget om, smides væk.
  const shotRef = useRef<Partial<Record<CaptureStep, number>>>({});
  // Forsidens hele billede i fuld opløsning, hørende til et bestemt skud.
  const frontFullRef = useRef<{ shot: number; url: string } | null>(null);
  // Trin, hvis billede stadig behandles efter udløseren ("Behandles …"), og
  // arbejdet, oprettelsen venter på.
  const [processing, setProcessing] = useState<Partial<Record<CaptureStep, boolean>>>({});
  const pendingPhotosRef = useRef<Promise<unknown>[]>([]);
  const inFlightRef = useRef<Partial<Record<CaptureStep, { shot: number; count: number }>>>({});

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
    flashRef.current = flash !== null || stepDone !== null;
  }, [flash, stepDone]);

  useEffect(() => {
    afterUnknownBarcodeRef.current = () => void flashThenContinue(null, markDone("barcode"), ["barcode"]);
  });

  // Flowets start og — hvis brugeren går uden at nå en vare — hvor langt
  // hen scanningen kom. Under 0,5 s er React's dobbelte montering i udvikling.
  // Lukkes appen/fanen, afmonteres intet, så "pagehide" melder det i stedet
  // (docs/DECISIONS.md 2026-10-03); kommer siden tilbage, kan det meldes igen.
  useEffect(() => {
    const startedAt = Date.now();
    flowStartedAtRef.current = startedAt;
    const leaving = leavingRef;
    const data = dataRef;
    const currentStep = stepRef;
    let abandonLogged = false;
    scanLog(flowId, "flow_start", {
      message: "Kameraflow åbnet",
      data: { userAgent: navigator.userAgent.slice(0, 200), language: navigator.language },
    });
    function logAbandoned(how: "left" | "closed") {
      const durationMs = Date.now() - startedAt;
      if (abandonLogged || leaving.current || durationMs < 500) return;
      abandonLogged = true;
      scanLog(flowId, "flow_abandoned", {
        level: "warn",
        message: `${how === "closed" ? "Appen lukket" : "Forladt"} uden vare på trinnet "${currentStep.current}"`,
        barcode: data.current.barcode,
        durationMs,
        data: { step: currentStep.current, how },
      });
    }
    const onPageHide = () => logAbandoned("closed");
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) abandonLogged = false;
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      logAbandoned("left");
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
          if (track) {
            void setContinuousFocus(track, controls);
            void setScanExposure(track);
          }
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

  // Nulstiller aflæsningen, når trinnet skifter — svar, der er undervejs
  // fra det gamle trin, ignoreres.
  function resetLiveScan() {
    runIdRef.current += 1;
    preReadBusyRef.current = false;
    preReadNextAtRef.current = 0;
    frontPreReadRef.current = null;
    labelPreReadRef.current = null;
    labelFailuresRef.current = 0;
    setPreRead(EMPTY_PRE_READ);
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
    void submitCapture();
  }

  async function submitCapture() {
    if (rescan) await submitRescan();
    else if (qualityCheckProductIdRef.current) await submitQualityCheck(qualityCheckProductIdRef.current);
    else await createProduct();
  }

  // Billeder, der stadig behandles (forsidens udsnit, sene aflæsninger),
  // kommer med i oprettelsen; der ventes højst PENDING_PHOTOS_WAIT_MS.
  async function awaitPendingPhotos() {
    const pending = pendingPhotosRef.current;
    if (!pending.length) return;
    const startedAt = Date.now();
    const finished = await Promise.race([Promise.all(pending).then(() => true), wait(PENDING_PHOTOS_WAIT_MS).then(() => false)]);
    pendingPhotosRef.current = [];
    scanLog(flowId, "pending_photos", {
      level: finished ? "info" : "warn",
      message: finished ? "Billederne var behandlet før oprettelsen" : `Billederne var ikke behandlet efter ${PENDING_PHOTOS_WAIT_MS / 1000} s — oprettes alligevel`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: { pending: pending.length },
    });
  }

  // Fotoene til 2-års tjekket. Kunden skal have varen med det samme, så et
  // fejlet upload stopper ikke flowet — det logges blot.
  async function submitQualityCheck(productId: string) {
    setWorking(true);
    setSubmitting(true);
    await awaitPendingPhotos();
    const startedAt = Date.now();
    const barcode = dataRef.current.barcode;
    const saved = await submitProductQualityCheck(
      productId,
      { ...dataRef.current, languageSignals: dataRef.current.languageSignals ?? readLanguageSignals(locale), flowId },
      marketRegion(),
    );
    scanLog(flowId, "flow_done", {
      level: saved ? "info" : "warn",
      message: saved
        ? "2-års tjek: fotos sendt — går til varen med dens tidligere info"
        : "2-års tjek: fotoene kunne ikke sendes — går til varen alligevel",
      barcode,
      productId,
      durationMs: Date.now() - flowStartedAtRef.current,
      data: { outcome: "quality-check", saved, submitMs: Date.now() - startedAt },
    });
    leaveTo(`/add/${productId}${returnSuffix}`);
  }

  async function submitRescan() {
    if (!rescan) return;
    setWorking(true);
    setSubmitting(true);
    setCreateFailed(false);
    await awaitPendingPhotos();
    const startedAt = Date.now();
    try {
      await submitProductRescan(
        rescan.productId,
        { ...dataRef.current, languageSignals: dataRef.current.languageSignals ?? readLanguageSignals(locale), flowId },
        marketRegion(),
      );
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
      submitFailed();
    }
  }

  // Oprettelsen/genscanningen fejlede: "Prøv igen" vises, og kameraet startes
  // igen, så et trin også kan tages om.
  function submitFailed() {
    setSubmitting(false);
    setWorking(false);
    setCreateFailed(true);
    restartCamera();
  }

  function markDone(...steps: CaptureStep[]) {
    const completed = { ...doneRef.current, ...Object.fromEntries(steps.map((item) => [item, true])) };
    doneRef.current = completed;
    setDone(completed);
    return completed;
  }

  // "Trinnet er klaret"-visningen (og evt. den hvide udfyldning) står et
  // øjeblik, og først derefter går flowet videre — også først når `pending`
  // (stillbilledet til serveren) er i hus.
  async function flashThenContinue(
    next: Flash | null,
    completed: Partial<Record<CaptureStep, boolean>>,
    justDone: CaptureStep[],
    pending: Promise<unknown> = Promise.resolve(),
  ) {
    setFlash(next);
    setStepDone(justDone);
    flashRef.current = true;
    const reduced = reducedMotion();
    const holdMs = Math.max(reduced ? FLASH_REDUCED_MS : FLASH_MS, reduced ? STEP_DONE_REDUCED_MS : STEP_DONE_MS);
    await Promise.all([wait(holdMs), pending.catch(() => {})]);
    if (leavingRef.current) return;
    setFlash(null);
    setStepDone(null);
    flashRef.current = false;
    goToNextStep(completed);
  }

  async function createProduct() {
    setWorking(true);
    setSubmitting(true);
    setCreateFailed(false);
    await awaitPendingPhotos();
    if (leavingRef.current) return;
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
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      // Serveren kan have oprettet varen, selvom svaret aldrig nåede frem.
      const createdId = barcode ? await findCreatedProduct(barcode, flowId) : null;
      if (leavingRef.current) return;
      scanLog(flowId, createdId ? "product_create_recovered" : "product_create_failed", {
        level: createdId ? "warn" : "error",
        message: `Oprettelsen ${timedOut ? "svarede ikke i tide" : "fejlede"}: ${String(error).slice(0, 200)}${createdId ? " — varen findes alligevel, går til den" : ""}`,
        barcode,
        productId: createdId,
        durationMs: Date.now() - startedAt,
        data: { timedOut },
      });
      if (createdId) {
        leaveTo(`/add/${createdId}${returnSuffix}`);
        return;
      }
      submitFailed();
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
      setLookupBlockedMessage(null);
      const startedAt = Date.now();
      try {
        const response = await fetch(`/api/products/lookup/${encodeURIComponent(code)}`, {
          headers: scanFlowHeaders(flowId),
        });
        const known = response.ok
          ? ((await response.json()) as { product: { id: string }; source?: string; qualityCheck?: boolean })
          : null;
        if (known && !known.qualityCheck) {
          const data = known;
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
        if (response.status === 422) {
          const blocked = (await response.json().catch(() => null)) as {
            code?: string;
            message?: string;
            incidentId?: string | null;
          } | null;
          if (blocked?.code === "PET_FOOD_BLOCKED") {
            scanLog(flowId, "barcode_blocked", { level: "warn", message: "Stregkoden er spærret (dyrefoder)", barcode: code });
            // Billedet af den spærrede scanning gemmes på hændelsen, så admin kan se, hvad brugeren forsøgte.
            const blockedFrame = blocked.incidentId ? captureVideoFrame(videoRef.current, BARCODE_PHOTO_MAX_SIDE) : null;
            if (blocked.incidentId && blockedFrame) {
              void fetch("/api/products/blocked-photo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ incidentId: blocked.incidentId, photo: blockedFrame.url }),
              }).catch(() => {});
            }
            setLookupBlockedMessage(blocked.message ?? "Dyrefoder kan ikke oprettes i Hello Cal.");
            setBarcodeDetection(null);
            activeCodeRef.current = null;
            lookupInProgressRef.current = false;
            return;
          }
        }
        if (!known && response.status !== 404) throw new Error(`Product lookup failed (${response.status})`);

        // Ukendt vare: gem stregkoden, vis trinnet som klaret og gå videre
        // til forsiden. Stregkodefotoet gemmes kun til serverens kvalitets-
        // kontrol/logo — det klarer ikke energi/indhold for brugeren (2026-10-14).
        // En vare over to år (2-års tjek) går samme vej uden stregkodefotoet.
        qualityCheckProductIdRef.current = known?.product.id ?? null;
        const frame = known ? null : captureVideoFrame(videoRef.current, BARCODE_PHOTO_MAX_SIDE);
        // Originalbilledet af stregkoden: hele kamerabilledet i fuld opløsning
        // (brugerens krav 2026-10-16), også ved 2-års tjekket.
        const original = captureVideoFrame(videoRef.current, ORIGINAL_MAX_SIDE);
        if (original) {
          void uploadBackPhoto(original, "barcode", flowId).then((ok) =>
            scanLog(flowId, ok ? "back_photo_uploaded" : "back_photo_failed", {
              level: ok ? "info" : "warn",
              message: ok
                ? `Originalbillede uploadet (barcode, ${original.width}×${original.height})`
                : "Originalbilledet kunne ikke uploades (barcode)",
              barcode: code,
            }),
          );
        }
        dataRef.current.barcode = code;
        dataRef.current.languageSignals = readLanguageSignals(locale);
        const context = buildBarcodeContext(code, region, dataRef.current.languageSignals);
        if (known) {
          scanLog(flowId, "barcode_quality_check", {
            message: "Kendt vare over to år gammel — fremstår som ny, kameraet tager nye fotos (2-års tjek)",
            barcode: code,
            productId: known.product.id,
          });
        } else if (frame) {
          void saveBarcodePhoto(frame.url, code, context.marketRegion, context.signals, flowId).then((id) => {
            if (id) dataRef.current.barcodeAnalysisId = id;
            else scanLog(flowId, "barcode_photo_failed", { level: "warn", message: "Stregkode-fotoet blev ikke gemt", barcode: code });
          });
        } else {
          scanLog(flowId, "barcode_photo_failed", { level: "warn", message: "Intet kamerabillede til stregkode-fotoet", barcode: code });
        }
        stopScanner();
        setBarcodeDetection(null);
        activeCodeRef.current = null;
        lookupInProgressRef.current = false;
        scanLog(flowId, "barcode_unknown", {
          message: known ? "2-års tjek — trin 1 klaret, videre til forsiden" : "Ukendt stregkode — trin 1 klaret, videre til forsiden",
          barcode: code,
          durationMs: Date.now() - startedAt,
        });
        afterUnknownBarcodeRef.current();
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

      // Først når samme kode er læst i flere billeder, er det en stregkode
      // og ikke et stribet mønster (docs/DECISIONS.md 2026-10-03).
      const sighting = recordBarcodeSighting(barcodeSightingsRef.current, code, Date.now());
      barcodeSightingsRef.current = sighting.history;
      if (!sighting.confirmed && code !== activeCodeRef.current) return;

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
    cameraStatus === "active" && !working && !flash && !stepDone && !createFailed && !barcodeDetection,
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

  // Forlæsningen kører på fototrinnene, mens kameraet er fremme og intet
  // trin er ved at blive klaret (docs/DECISIONS.md 2026-10-15).
  const preReadFrameRef = useRef<(frame: LiveFrame) => void>(() => {});
  useEffect(() => {
    preReadFrameRef.current = (frame) => void preReadFrame(frame);
  });
  const canPreRead = useCallback(
    () => !preReadBusyRef.current && Date.now() >= preReadNextAtRef.current && !flashRef.current && !leavingRef.current,
    [],
  );
  const onPreReadFrame = useCallback((frame: LiveFrame) => preReadFrameRef.current(frame), []);
  const preReading = step !== "barcode" && cameraStatus === "active" && !working && !flash && !stepDone && !submitting && !createFailed;
  useLiveFrames(videoRef, preReading, PRE_READ_MIN_PROGRESS, PHOTO_CROP, LIVE_FRAME_MAX_SIDE, canPreRead, onPreReadFrame);

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

  // Fotoet til serveren: kameraets stillbillede (ellers det skarpeste af tre
  // videobilleder); fejler det, bruges udløserens eget videobillede. Kaldes i
  // samme øjeblik, som udløseren trykkes (brugerens krav 2026-10-15).
  // Energi/indhold tager også hele, ubeskårne kamerabillede af samme billede
  // og uploader det til nattens engangsanalyse (docs/DECISIONS.md 2026-10-15).
  async function takeStill(step: CaptureStep, fallback: LiveFrame, shot = 0): Promise<Still> {
    const startedAt = Date.now();
    let captured: Still | null;
    if (step === "nutrition" || step === "ingredients") {
      const pair = await captureStillWithFull(videoRef.current, PHOTO_CROP);
      captured = pair?.still ?? null;
      if (pair) trackProcessing(step, shot, uploadFullPhoto(step, pair.full));
    } else if (step === "front") {
      // Forsiden gemmes i fuld opløsning (brugerens krav 2026-10-15) — samme
      // kvadrat som søgeren; AI'en får den nedskalerede kopi af samme billede.
      const pair = await captureStillWithFull(videoRef.current, PHOTO_CROP, PHOTO_CROP);
      captured = pair?.still ?? null;
      frontFullRef.current = pair ? { shot, url: pair.full.url } : null;
      // Hele, ubeskårne originalbillede gemmes også (brugerens krav 2026-10-16).
      if (pair) trackProcessing(step, shot, uploadFullPhoto("front", pair.original));
    } else {
      captured = await captureStill(videoRef.current, PHOTO_CROP);
    }
    const still = captured ?? fallback;
    scanLog(flowId, "photo_captured", {
      message: `Foto til trinnet "${step}": ${still === fallback ? "udløserens videobillede" : still.source === "photo" ? "stillbillede" : "videobillede"} ${still.width}×${still.height}, skarphed ${still.sharpness}`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: { step, source: still === fallback ? "live" : still.source, width: still.width, height: still.height, sharpness: still.sharpness, stillPhoto: stillPhotoSupported() },
    });
    return still;
  }

  // Originalbilledet af hver optagelse (brugerens krav 2026-10-16: "Jeg skal
  // have original af det hele"): stregkode, forside, energi og indhold.
  async function uploadFullPhoto(step: "barcode" | "front" | "nutrition" | "ingredients", full: Still) {
    const startedAt = Date.now();
    const ok = await uploadBackPhoto(full, step, flowId);
    scanLog(flowId, ok ? "back_photo_uploaded" : "back_photo_failed", {
      level: ok ? "info" : "warn",
      message: ok
        ? `Originalbillede uploadet (${step}, ${full.width}×${full.height})`
        : `Originalbilledet kunne ikke uploades (${step})`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: { step, width: full.width, height: full.height, bytes: Math.round(full.url.length * 0.75) },
    });
  }

  // Forlæsningen (brugerens krav 2026-10-15): mens brugeren sigter, læses et
  // videobillede ad gangen lokalt — forsidens tekst (dublet + kendt mærke) og
  // energi/indholds næringstabel og ingrediensliste. Fundene vises i
  // kamerabilledet og bruges af udløseren; trinnet klares aldrig af sig selv.
  async function preReadFrame(frame: LiveFrame) {
    const current = stepRef.current;
    if (current === "barcode" || preReadBusyRef.current) return;
    preReadBusyRef.current = true;
    const runId = runIdRef.current;
    try {
      if (current === "front") {
        const read = await readFrontPhoto(frame.url, ocrLanguages(), flowId, { preRead: true });
        if (runId !== runIdRef.current) return;
        const previous = frontPreReadRef.current;
        // Et fund (dublet, mærke) holdes fast; en senere, uskarpere aflæsning sletter det ikke.
        const merged: FrontRead = previous
          ? {
              ...read,
              textLength: Math.max(read.textLength, previous.read.textLength),
              // Den længste tekst gemmes som reserve til navn/brand (frontOcrText).
              text: read.text.length >= previous.read.text.length ? read.text : previous.read.text,
              duplicateId: read.duplicateId ?? previous.read.duplicateId,
              duplicateName: read.duplicateId ? read.duplicateName : previous.read.duplicateName,
              brand: read.brand ?? previous.read.brand,
            }
          : read;
        const reads = (previous?.reads ?? 0) + 1;
        const at = read.textLength ? Date.now() : (previous?.at ?? 0);
        frontPreReadRef.current = { at, read: merged, reads };
        setPreRead({
          ...EMPTY_PRE_READ,
          reads,
          textFound: merged.textLength > 0,
          brand: merged.brand,
          duplicate: merged.duplicateId ? (merged.duplicateName ?? "") : null,
        });
        return;
      }
      const need: LabelNeed = current;
      const read = await readLabelPhoto(frame.url, ocrLanguages());
      if (runId !== runIdRef.current) return;
      if (read.ocrFailed) {
        labelFailuresRef.current += 1;
        if (labelFailuresRef.current === 1 || labelFailuresRef.current % LABEL_LOG_EVERY === 0) {
          scanLog(flowId, "label_ocr_error", {
            level: "error",
            message: `${need === "nutrition" ? "Energi" : "Indhold"}: forlæsningen fejlede (${labelFailuresRef.current} gang(e)) — AI læser billedet`,
            barcode: dataRef.current.barcode,
            data: { failures: labelFailuresRef.current },
          });
        }
      }
      const previous = labelPreReadRef.current;
      const reads = (previous?.reads ?? 0) + 1;
      const attempt = countsAsAttempt(read)
        ? mergeLabelAttempts(previous?.attempt ?? null, { frame, read }, need)
        : (previous?.attempt ?? null);
      labelPreReadRef.current = {
        at: countsAsAttempt(read) ? Date.now() : (previous?.at ?? 0),
        attempt,
        reads,
      };
      setPreRead({
        ...EMPTY_PRE_READ,
        reads,
        textFound: Boolean(attempt?.read.text),
        nutrition: attempt ? labelFound(attempt.read, "nutrition") : false,
        ingredients: attempt ? labelFound(attempt.read, "ingredients") : false,
      });
    } finally {
      if (runId === runIdRef.current) {
        preReadBusyRef.current = false;
        preReadNextAtRef.current = Date.now() + PRE_READ_GAP_MS;
      }
    }
  }

  // Objektgenkendelsen afgør kun, om der er en vare i billedet (afvisning af
  // bukseben/bord) og logger, hvilken der står i rammens midte. Forsidefotoet
  // beskæres ALDRIG efter AI'ens boks (bruger 2026-10-15: "halveret … Det må
  // ikke ske"): boksene er upræcise og skar varen midt over. Rammen, brugeren
  // sigter med, er udsnittet — hele billedet bruges altid.
  async function chooseObject(frame: string): Promise<{ chosen: string; objects: ObjectBox[] | null }> {
    const startedAt = Date.now();
    const objects = await detectObjects(frame);
    const picked = pickObjectInFocus(objects ?? []);
    scanLog(flowId, "front_objects", {
      level: objects ? "info" : "warn",
      message: !objects
        ? "Forsiden: objektgenkendelsen svarede ikke — hele billedet bruges"
        : objects.length < 2
          ? `Forsiden: ${objects.length} objekt(er) fundet — hele billedet bruges`
          : picked
            ? `Forsiden: ${objects.length} objekter fundet — "${picked.label}" i rammens midte; hele billedet bruges`
            : `Forsiden: ${objects.length} objekter fundet, ingen i rammens midte — hele billedet bruges`,
      barcode: dataRef.current.barcode,
      durationMs: Date.now() - startedAt,
      data: { objects: objects?.map((object) => object.label) ?? null, picked: picked?.label ?? null },
    });
    return { chosen: frame, objects };
  }

  // Et billede, der stadig behandles efter udløseren: trinnets knap viser
  // "Behandles …", og oprettelsen venter på det (højst PENDING_PHOTOS_WAIT_MS).
  // Et trin kan have flere ting i gang (aflæsning + upload af hele billedet):
  // knappen viser "Behandles", til alle er færdige.
  function trackProcessing(step: CaptureStep, shot: number, work: Promise<unknown>) {
    const entry = inFlightRef.current[step];
    inFlightRef.current[step] = entry?.shot === shot ? { shot, count: entry.count + 1 } : { shot, count: 1 };
    setProcessing((current) => ({ ...current, [step]: true }));
    const settled = work.catch(() => {}).finally(() => {
      const current = inFlightRef.current[step];
      if (!current || current.shot !== shot) return;
      current.count -= 1;
      if (current.count <= 0 && shotRef.current[step] === shot) setProcessing((state) => ({ ...state, [step]: false }));
    });
    pendingPhotosRef.current.push(settled);
  }

  // "Trinnet er klaret" står fra trykket; flowet går først videre, når
  // visningen har stået, og fotoet er i hus.
  async function finishShutterStep(pressedAt: number, justDone: CaptureStep[], photo: Promise<unknown>) {
    const reduced = reducedMotion();
    const holdMs = Math.max(reduced ? FLASH_REDUCED_MS : FLASH_MS, reduced ? STEP_DONE_REDUCED_MS : STEP_DONE_MS);
    await Promise.all([wait(Math.max(0, pressedAt + holdMs - Date.now())), photo.catch(() => {})]);
    if (leavingRef.current) return;
    setFlash(null);
    setStepDone(null);
    flashRef.current = false;
    goToNextStep({ ...doneRef.current });
  }

  // Forsiden efter udløseren: trinnet er klaret med det samme. Fandt
  // forlæsningen en eksisterende vare, går flowet til den. Ellers logges
  // varerne i billedet i baggrunden (fotoet beskæres aldrig), og uden
  // forlæsning læses teksten af udløserens billede (dublet-tjek, højst
  // SHUTTER_ANALYSIS_WAIT_MS).
  async function shootFront(live: LiveFrame, still: Promise<Still>, pressedAt: number, shot: number) {
    const data = dataRef.current;
    const languages = ocrLanguages();
    const pre = frontPreReadRef.current;
    const fresh = pre && pre.read.textLength > 0 && pressedAt - pre.at <= PRE_READ_FRESH_MS ? pre.read : null;
    // Ved en genscanning eller et 2-års tjek er "dubletten" netop varen selv.
    if (fresh?.duplicateId && !rescan && !qualityCheckProductIdRef.current) {
      scanLog(flowId, "flow_done", {
        message: `Forlæsningen fandt en eksisterende vare${fresh.duplicateName ? ` ("${fresh.duplicateName}")` : ""} — går til den`,
        barcode: data.barcode,
        productId: fresh.duplicateId,
        durationMs: Date.now() - flowStartedAtRef.current,
        data: { outcome: "duplicate", source: "preRead" },
      });
      recordProductScan(fresh.duplicateId);
      leaveTo(`/add/${fresh.duplicateId}${returnSuffix}`);
      return;
    }
    setFlash({ kind: "object" });
    setStepDone(["front"]);
    markDone("front");
    const current = () => shotRef.current.front === shot && !leavingRef.current;
    const photo = still.then(async (taken) => {
      if (!current()) return;
      data.frontPhoto = taken.url;
      const full = frontFullRef.current;
      data.frontPhotoFull = full?.shot === shot ? full.url : undefined;
      const { chosen, objects } = await chooseObject(taken.url);
      if (!current()) return;
      data.frontPhoto = chosen;
      scanLogPhoto(flowId, "front", chosen, data.barcode);
      return objects;
    });
    const textRead = fresh ? Promise.resolve(fresh) : readFrontPhoto(live.url, languages, flowId);
    const logged = textRead.then((front) => {
      // Reserve, hvis AI'en ikke kan læse forsiden (docs/DECISIONS.md 2026-10-16).
      if (current() && front.text) data.frontOcrText = front.text;
      scanLog(flowId, "front_photo", {
        level: front.lookupFailed || front.ocrFailed ? "warn" : "info",
        message: front.textLength
          ? `Forside læst ${fresh ? "af forlæsningen" : "af udløserens billede"} (${front.textLength} tegn, sikkerhed ${Math.round(front.confidence)} %)${front.brand ? `, mærke "${front.brand}"` : ""}${front.duplicateId ? " — dublet fundet" : ""}`
          : front.ocrFailed
            ? "Forside: den lokale tekstlæsning fejlede (AI læser den efter oprettelse)"
            : "Forside: ingen læsbar tekst lokalt (AI læser den efter oprettelse)",
        barcode: data.barcode,
        productId: front.duplicateId,
        durationMs: Date.now() - pressedAt,
        data: { ...front, text: front.text.slice(0, 500), languages, source: fresh ? "preRead" : "shutter", preReads: pre?.reads ?? 0 },
      });
      return front;
    });
    trackProcessing("front", shot, Promise.all([photo, logged]));
    const early = await Promise.race([logged, wait(SHUTTER_ANALYSIS_WAIT_MS).then(() => null)]);
    if (leavingRef.current || !current()) return;
    // Ved et 2-års tjek er "dubletten" netop varen selv.
    if (early?.duplicateId && !rescan && !qualityCheckProductIdRef.current) {
      scanLog(flowId, "flow_done", {
        message: "Forsideteksten matcher en eksisterende vare — går til den",
        barcode: data.barcode,
        productId: early.duplicateId,
        durationMs: Date.now() - flowStartedAtRef.current,
        data: { outcome: "duplicate", source: "shutter" },
      });
      recordProductScan(early.duplicateId);
      leaveTo(`/add/${early.duplicateId}${returnSuffix}`);
      return;
    }
    await finishShutterStep(pressedAt, ["front"], still);
  }

  // Energi/indholds aflæsning gemmes til oprettelsen (serveren bruger
  // telefonens aflæsning, når den er sikker; ellers læser AI fotoet).
  // `canSkip`: står ingredienslisten på energibilledet, klares indholds-
  // trinnet også — kun når aflæsningen var klar, mens trinnet stod.
  function applyLabel(need: LabelNeed, attempt: LabelAttempt<LiveFrame> | null, source: string, pressedAt: number, canSkip: boolean) {
    const data = dataRef.current;
    const read = attempt?.read ?? EMPTY_LABEL_READ;
    const languages = ocrLanguages();
    if (need === "nutrition") {
      const ingredientsFound = canSkip && labelFound(read, "ingredients");
      scanLog(flowId, "nutrition_photo", {
        message: read.nutrition
          ? `Energi læst lokalt (${source}, sikkerhed ${Math.round(read.confidence)} %)${ingredientsFound ? " + ingrediensliste på samme billede" : ""}`
          : `Energi: næringstabellen kunne ikke læses lokalt (${source}, ${read.text.length} tegn) — AI læser den${ingredientsFound ? " (+ ingrediensliste på samme billede)" : ""}`,
        barcode: data.barcode,
        durationMs: Date.now() - pressedAt,
        data: {
          source,
          textLength: read.text.length,
          confidence: read.confidence,
          nutrition: read.nutrition,
          ingredientsOnSamePhoto: ingredientsFound,
          localIngredients: Boolean(read.ingredientsText),
          languages,
        },
      });
      data.nutritionOcrText = read.text;
      data.nutritionOcrConfidence = read.confidence;
      data.localNutrition = read.nutrition;
      if (canSkip) {
        data.ingredientsOnNutritionPhoto = ingredientsFound;
        if (ingredientsFound) {
          data.localIngredientsText = read.ingredientsText ?? undefined;
          if (data.nutritionPhoto) data.ingredientsPhoto = data.nutritionPhoto;
        }
      }
      return ingredientsFound;
    }
    const ingredientsText = read.ingredientsText ?? "";
    scanLog(flowId, "ingredients_photo", {
      message: ingredientsText
        ? `Ingredienser læst lokalt (${source}, ${ingredientsText.length} tegn, sikkerhed ${Math.round(read.confidence)} %)`
        : `Ingredienser: ingen ingrediensliste fundet lokalt (${source}, ${read.text.length} tegn) — AI læser den`,
      barcode: data.barcode,
      durationMs: Date.now() - pressedAt,
      data: { source, textLength: read.text.length, confidence: read.confidence, ingredientsLength: ingredientsText.length, languages },
    });
    data.ingredientsOcrText = read.text;
    data.ingredientsOcrConfidence = read.confidence;
    data.ingredientsOnNutritionPhoto = false;
    data.localIngredientsText = ingredientsText || undefined;
    return false;
  }

  // Energi-trinnet (brugerens krav 2026-10-16): telefonens egen aflæsning af
  // næringstabellen, ellers AI'en på fotoet, mens brugeren venter ("Læser
  // energien …"). Kun en komplet aflæsning klarer trinnet; ellers står en
  // besked, og billedet tages om. Ingen skøn.
  async function verifyEnergy(
    analysis: Promise<{ attempt: LabelAttempt<LiveFrame>; source: string }>,
    still: Promise<Still>,
    shot: number,
  ): Promise<boolean> {
    const data = dataRef.current;
    const current = () => shotRef.current.nutrition === shot && !leavingRef.current;
    const startedAt = Date.now();
    setEnergyError(null);
    setWorking(true);
    setEnergyReading(true);
    try {
      const local = await Promise.race([analysis, wait(ENERGY_LOCAL_WAIT_MS).then(() => null)]).catch(() => null);
      if (local?.attempt.read.nutrition) {
        data.nutritionAnalysisId = undefined;
        return true;
      }
      const taken = await still.catch(() => null);
      if (!current()) return false;
      if (local) data.nutritionOcrText = local.attempt.read.text;
      const result = taken ? await readEnergyPhoto(taken.url, data, marketRegion()) : ({ ok: false, reason: "error" } as const);
      if (!current()) return false;
      scanLog(flowId, "energy_step", {
        level: result.ok ? "info" : "warn",
        message: result.ok
          ? "Energi læst af AI — trinnet er klaret"
          : result.reason === "ai_unavailable"
            ? "Energi: AI'en er ikke tilgængelig (ingen kredit) — trinnet er ikke klaret"
            : "Energi kunne ikke læses — brugeren skal tage billedet om",
        barcode: data.barcode,
        durationMs: Date.now() - startedAt,
        data: { reason: result.ok ? null : result.reason },
      });
      if (result.ok) {
        data.nutritionAnalysisId = result.analysisId;
        return true;
      }
      data.nutritionAnalysisId = undefined;
      setEnergyError(result.reason);
      return false;
    } finally {
      setEnergyReading(false);
      setWorking(false);
    }
  }

  // Energi/indhold efter udløseren: trinnet er klaret med det samme.
  // Forlæsningen bruges, hvis den fandt feltet; ellers læses udløserens
  // billede (højst SHUTTER_ANALYSIS_WAIT_MS, mens "trinnet er klaret" står —
  // kommer svaret senere, gemmes det blot til oprettelsen).
  async function shootLabel(need: LabelNeed, live: LiveFrame, still: Promise<Still>, pressedAt: number, shot: number) {
    const data = dataRef.current;
    const pre = labelPreReadRef.current;
    const fresh = pre?.attempt && pressedAt - pre.at <= PRE_READ_FRESH_MS ? pre.attempt : null;
    const ready = fresh && labelFound(fresh.read, need) ? fresh : null;
    const current = () => shotRef.current[need] === shot && !leavingRef.current;
    const analysis: Promise<{ attempt: LabelAttempt<LiveFrame>; source: string }> = ready
      ? Promise.resolve({ attempt: ready, source: "forlæsning" })
      : readLabelPhoto(live.url, ocrLanguages()).then((read) => {
          const own = { frame: live, read };
          return { attempt: fresh ? mergeLabelAttempts(fresh, own, need) : own, source: "udløserens billede" };
        });
    const photo = still.then((taken) => {
      if (!current()) return;
      scanLogPhoto(flowId, need, taken.url, data.barcode);
      if (need === "nutrition") {
        data.nutritionPhoto = taken.url;
        if (data.ingredientsOnNutritionPhoto) data.ingredientsPhoto = taken.url;
      } else {
        data.ingredientsPhoto = taken.url;
      }
    });
    // Energien skal være læst, før trinnet er klaret — ellers tages billedet om
    // (brugerens krav 2026-10-16: "man kan ikke fortsætte flowet hvis det fejler").
    if (need === "nutrition" && !(await verifyEnergy(analysis, still, shot))) {
      flashRef.current = false;
      return;
    }
    setFlash(ready ? labelFlash(ready.frame, ready.read.regions, need === "ingredients" ? "ingredients" : undefined) : null);
    setStepDone([need]);
    markDone(need);
    // Aflæsningen gemmes én gang: med det samme, hvis den var klar, mens
    // "trinnet er klaret" stod (så kan indholds-trinnet springes over), ellers
    // når den kommer. Oprettelsen venter på den (trackProcessing).
    let resolveApplied: () => void = () => {};
    const applied = new Promise<void>((resolve) => {
      resolveApplied = resolve;
    });
    trackProcessing(need, shot, Promise.all([photo, applied]));
    const early = await Promise.race([analysis, wait(SHUTTER_ANALYSIS_WAIT_MS).then(() => null)]).catch(() => null);
    if (!early) {
      void analysis
        .then((result) => {
          if (current()) applyLabel(need, result.attempt, result.source, pressedAt, false);
        })
        .catch(() => {})
        .finally(resolveApplied);
    }
    if (leavingRef.current || !current()) {
      resolveApplied();
      return;
    }
    const justDone: CaptureStep[] = [need];
    if (early) {
      const bothOnPhoto = applyLabel(need, early.attempt, early.source, pressedAt, need === "nutrition");
      resolveApplied();
      if (bothOnPhoto) {
        // Indholdet står ved siden af næringstabellen: begge får flueben.
        markDone("ingredients");
        justDone.push("ingredients");
        setStepDone([...justDone]);
        setFlash(labelFlash(early.attempt.frame, early.attempt.read.regions));
      } else if (!ready) {
        setFlash(labelFlash(early.attempt.frame, early.attempt.read.regions, need === "ingredients" ? "ingredients" : undefined));
      }
    } else {
      scanLog(flowId, "label_late", {
        level: "warn",
        message: `${need === "nutrition" ? "Energi" : "Indhold"}: aflæsningen var ikke klar efter ${SHUTTER_ANALYSIS_WAIT_MS / 1000} s — flowet går videre, AI læser fotoet`,
        barcode: data.barcode,
        data: { step: need },
      });
    }
    await finishShutterStep(pressedAt, justDone, still);
  }

  // Udløseren nederst i kamerabilledet (bruger 2026-10-14): billedet tages i
  // trykøjeblikket, og trinnet er klaret med det samme (2026-10-15).
  function capturePhoto() {
    if (working || step === "barcode" || flash || stepDone || flashRef.current || cameraStatus !== "active") return;
    const current = step;
    const pressedAt = Date.now();
    const live = captureVideoFrame(videoRef.current, LIVE_FRAME_MAX_SIDE, PHOTO_CROP);
    if (!live) {
      scanLog(flowId, "photo_capture_failed", { level: "warn", message: `Intet kamerabillede på trinnet "${current}"`, barcode: dataRef.current.barcode });
      return;
    }
    flashRef.current = true;
    setEnergyError(null);
    const shot = (shotRef.current[current] ?? 0) + 1;
    shotRef.current[current] = shot;
    const still = takeStill(current, live, shot);
    scanLog(flowId, "shutter", {
      message: `Udløseren trykket på trinnet "${current}"`,
      barcode: dataRef.current.barcode,
      data: { step: current, sharpness: Math.round(live.sharpness), preRead },
    });
    if (current === "front") void shootFront(live, still, pressedAt, shot);
    else void shootLabel(current, live, still, pressedAt, shot);
  }

  // "Spring over" nederst i kamerabilledet på indholds-trinnet (bruger
  // 2026-10-14): varer uden indholdsfortegnelse (vand, sukker, frugt …) kan
  // ellers aldrig komme videre, fordi billeder uden tekst ikke tæller. Trinnet
  // markeres klaret uden foto; AI får ingen ingrediensliste at læse. Trinnet
  // findes slet ikke, når listen allerede stod på energibilledet.
  function skipIngredients() {
    if (working || flash || stepDone || step !== "ingredients") return;
    const data = dataRef.current;
    scanLog(flowId, "ingredients_skipped", {
      message: "Indhold sprunget over — brugeren trykkede Spring over (varen har ingen indholdsfortegnelse)",
      barcode: data.barcode,
      data: { step: stepRef.current },
    });
    data.ingredientsPhoto = undefined;
    data.ingredientsOcrText = undefined;
    data.ingredientsOcrConfidence = undefined;
    data.localIngredientsText = undefined;
    data.ingredientsOnNutritionPhoto = false;
    // Et tidligere indholdsbillede, der stadig behandles, må ikke skrive bagefter.
    shotRef.current.ingredients = (shotRef.current.ingredients ?? 0) + 1;
    setProcessing((current) => ({ ...current, ingredients: false }));
    resetLiveScan();
    goToNextStep(markDone("ingredients"));
  }

  // Et trin med flueben kan tages om ved at trykke på det (bruger
  // 2026-10-14). Stregkoden starter forfra: en ny stregkode er en anden vare,
  // så fotos og aflæsninger nulstilles.
  function selectStep(next: CaptureStep) {
    if (working || flash || stepDone || next === step) return;
    if (!visibleSteps.includes(next)) return;
    // Uden stregkode kan intet andet trin aflæses (sprog/region følger den).
    if (next !== "barcode" && !done.barcode) return;
    if (next === "barcode" && done.barcode) {
      restartFlow();
      return;
    }
    resetLiveScan();
    setStep(next);
  }

  function restartFlow() {
    scanLog(flowId, "flow_restart", {
      message: `Forfra fra stregkoden (brugeren trykkede på Stregkode på trinnet "${stepRef.current}")`,
      barcode: dataRef.current.barcode,
      data: { from: stepRef.current },
    });
    resetLiveScan();
    dataRef.current = {};
    qualityCheckProductIdRef.current = null;
    doneRef.current = {};
    shotRef.current = {};
    pendingPhotosRef.current = [];
    setProcessing({});
    setDone({});
    setCreateFailed(false);
    setLookupError(false);
    setLookupBlockedMessage(null);
    setBarcodeDetection(null);
    activeCodeRef.current = null;
    barcodeSightingsRef.current = [];
    setStep("barcode");
  }

  function restartCamera() {
    setCameraStatus("starting");
    setRestartKey((key) => key + 1);
  }

  // Sort/stoppet kamera (iPhone): logges og startes igen af sig selv.
  useCameraWatchdog({
    videoRef,
    streamRef,
    enabled: cameraStatus === "active" && !submitting,
    flowId,
    step,
    onRestart: restartCamera,
  });

  // Under oprettelsen bruges kameraet ikke: det slukkes (efter vagthunden,
  // så et stoppet spor ikke tolkes som et dødt kamera).
  useEffect(() => {
    if (submitting) stopCamera();
  }, [submitting, stopCamera]);

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
  const stepHints: Record<CaptureStep, string> = {
    barcode: lookupBlockedMessage ?? (lookupError ? (online ? t("camera.barcodeLookupError") : t("offline.barcodeLookup")) : t("camera.holdCameraStill")),
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
  // Forsiden står bag oprettelsen i stedet for et sort, slukket kamera.
  const submitPhoto = submitting ? (dataRef.current.frontPhoto ?? null) : null;
  const submitText = t(rescan ? "cameraCreate.sendingPhotos" : "cameraCreate.creating");
  // Beskeden nederst i kamerabilledet: lys/fokus.
  const energyNotice =
    step === "nutrition" && energyError
      ? t(energyError === "ai_unavailable" ? "cameraCreate.energyAiUnavailable" : "cameraCreate.energyUnreadable")
      : null;
  const viewfinderNotice = energyNotice ?? (frameIssue
    ? frameIssue === "dark"
      ? cameraControls.torch && !torchOn
        ? t("camera.qualityDarkTorch")
        : t("camera.qualityDark")
      : scanning
        ? t("camera.qualityBlurryBarcode")
        : t("camera.qualityBlurry")
    : null);
  // Forlæsningen kører stille i baggrunden — ingen "Læser teksten …" eller
  // fund-beskeder i billedet (brugerens krav 2026-10-15: "Den skal bare gøre
  // det uden at du skal skrive noget").
  // Trin, hvis billede stadig behandles efter udløseren.
  const processingSteps = visibleSteps.filter((item) => processing[item]);
  // Trinnets nummer i overskriften følger de viste trin (1–4; ved genscanning færre).
  const stepNumber = (item: CaptureStep) => visibleSteps.indexOf(item) + 1;
  const guideStep: Exclude<CaptureStep, "barcode"> = step === "barcode" ? "front" : step;
  // "Spring over" kun på indholds-trinnet, og ikke ved en genscanning, der
  // alene mangler indholdet (så ville der intet være at sende).
  // Udløseren nederst i kamerabilledet på de tre fototrin.
  const showShutter = step !== "barcode" && cameraStatus === "active" && !cameraMessage && !working && !flash && !stepDone && !createFailed;
  const canSkipIngredients = showShutter && step === "ingredients" && !(rescan && rescan.steps.length === 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Udløseren nederst i kamerabilledet tager fotoet (brugerens krav
          2026-10-14: "gammeldags billede") — intet tryk på selve billedet. */}
      <div className="hf-camera-preview">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          aria-label={t("camera.liveViewAriaLabel")}
        />
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

        {!scanning && !flash && !stepDone && (
          <div
            className="pointer-events-none absolute border-2 transition-colors rounded-card"
            style={{
              inset: GUIDE_INSET[guideStep],
              boxShadow: `0 0 0 999px rgba(0,0,0,${GUIDE_DIM[guideStep]})`,
              borderColor: "rgba(255,255,255,0.8)",
            }}
          />
        )}

        {energyReading && !submitting && (
          <div className="absolute inset-0">
            <PhotoWorkingOverlay label={t("cameraCreate.readingEnergy")} showLabel={false} />
            <div className="hf-camera-overlay" aria-live="polite">
              <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{t("cameraCreate.readingEnergy")}</p>
            </div>
          </div>
        )}

        {submitting && (
          <div className="absolute inset-0 bg-hf-black">
            {submitPhoto && (
              // eslint-disable-next-line @next/next/no-img-element -- lokalt data-URL-foto
              <img src={submitPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <PhotoWorkingOverlay label={submitText} showLabel={false} />
            <div className="hf-camera-overlay" aria-hidden>
              <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{submitText}</p>
            </div>
          </div>
        )}

        <ProductOutlineOverlay
          videoRef={videoRef}
          active={!scanning && !working && !flash && !stepDone && cameraStatus === "active"}
          fill={flash?.kind === "object"}
          flowId={flowId}
        />

        {viewfinderNotice && !cameraMessage && !stepDone && !submitting && (
          <div
            className={`pointer-events-none absolute inset-x-3 flex justify-center ${showShutter ? "bottom-24" : "bottom-3"}`}
            aria-live="polite"
          >
            <p className="hf-type-small hf-type-strong flex items-center gap-1.5 bg-hf-black/60 px-3 py-1.5 text-center text-hf-white rounded-card">
              {viewfinderNotice}
            </p>
          </div>
        )}

        {showShutter && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-center">
            <button
              type="button"
              onClick={() => void capturePhoto()}
              aria-label={t("cameraCreate.shutter")}
              className="hf-shutter"
            >
              <span className="hf-shutter__inner" />
            </button>
            {canSkipIngredients && (
              <button
                type="button"
                onClick={skipIngredients}
                className="hf-type-small hf-type-strong absolute right-0 flex h-11 items-center justify-center bg-hf-black/60 px-5 text-hf-white rounded-card"
              >
                {t("cameraCreate.skipIngredients")}
              </button>
            )}
          </div>
        )}

        {cameraControls.torch && cameraStatus === "active" && !working && !flash && !stepDone && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
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

        {cameraMessage && !submitting && (
          <div
            className="hf-camera-overlay"
            onClick={cameraStatus === "denied" || cameraStatus === "error" ? restartCamera : undefined}
          >
            <p className="hf-type-body hf-type-strong max-w-xs text-hf-white">{cameraMessage}</p>
          </div>
        )}

        {stepDone && (
          <StepDoneOverlay
            steps={stepDone.map((item) => ({ number: stepNumber(item), title: stepHeadings[item] }))}
            label={stepDone.map((item) => t("cameraCreate.stepDone", { step: stepLabels[item] })).join(". ")}
          />
        )}

        {!cameraMessage && !stepDone && !submitting && (
          <ScanHeading number={stepNumber(step)} title={stepHeadings[step]} />
        )}
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${visibleSteps.length}, minmax(0, 1fr))` }}
      >
        {visibleSteps.map((item) => {
          const StepIcon = STEP_ICONS[item];
          const disabled = working || (item !== "barcode" && !done.barcode);
          return (
            <button
              key={item}
              type="button"
              onClick={() => selectStep(item)}
              disabled={disabled && item !== step}
              aria-current={item === step ? "step" : undefined}
              className="relative flex h-16 flex-col items-center justify-center gap-1 overflow-hidden bg-hf-tan px-1 text-center text-hf-black disabled:opacity-50 rounded-card"
              style={{
                outline: item === step ? "2px solid var(--hf-color-brand)" : undefined,
                outlineOffset: -2,
              }}
            >
              <StepIcon size={20} stroke={1.8} />
              <span className="hf-type-micro">{stepLabels[item]}</span>
              {done[item] && (
                <CaptureCheckOverlay label={t("cameraCreate.stepDone", { step: stepLabels[item] })} size={48} />
              )}
              {processing[item] && (
                <span className="absolute right-1.5 top-1.5" aria-hidden>
                  <HfLoader size={16} className="text-hf-green" />
                </span>
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
            onClick={() => void submitCapture()}
            className="hf-control hf-btn-primary px-6"
          >
            {t("cameraCreate.retry")}
          </button>
        </div>
      ) : (
        <>
          {processingSteps.length > 0 && (
            <p className="hf-type-small hf-type-strong flex items-center justify-center gap-2 text-center" role="status">
              <HfLoader size={16} />
              {t("cameraCreate.processingPhotos", { steps: processingSteps.map((item) => stepLabels[item]).join(", ") })}
            </p>
          )}
          <p className="hf-type-caption text-center">{stepHints[step]}</p>
          {step !== "barcode" && (
            <p className="hf-type-micro text-text-secondary text-center">{t("cameraCreate.shutterHint")}</p>
          )}
          {!rescan && Object.values(done).some(Boolean) && (
            <p className="hf-type-micro text-text-secondary text-center">{t("cameraCreate.retakeHint")}</p>
          )}
        </>
      )}
    </div>
  );
}
