"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera } from "@tabler/icons-react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { ChecksumException, FormatException, NotFoundException } from "@zxing/library";
import { HfScreen } from "@/components/HfScreen";
import { ScanningOverlay } from "@/components/hf/ScanningOverlay";
import { HfBarcodeIcon } from "@/components/hf/HfBarcodeIcon";
import { parseNutritionText } from "@/lib/product-ocr";
import { extractTextPrioritized } from "@/lib/product-ocr-prioritized";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { PRODUCT_DRAFT_STORAGE_KEY, type ProductCreateDraft } from "@/lib/product-draft";
import type {
  IngredientsAnalysis,
  NutritionAnalysis,
  ProductFrontAnalysis,
} from "@/lib/product-analysis-types";
import { useTranslation } from "@/i18n/LocaleProvider";

// Bindende flow (docs/DECISIONS.md, 2026-09-17):
// STREGKODE ALTID FØRST -> forside -> ingredienser -> næring -> produkt-create.
// Senere billeder må aldrig ændre markedsregion/GS1-signalet fra barcode-trinnet.
//
// Hvert kamera-capture gemmer altid HELE videobilledet (capturePhotoFromVideo
// tegner hele <video>-framen på canvas, ikke kun et beskåret fokusområde) —
// også det der ligger uden for selve stregkoden/feltet, selv når det ikke er
// skarpt. Det originale billede sendes både til AI-analysen og gemmes som
// produktets barcodeImage/mainImage/ingredientsImage/nutritionImage, så intet
// af det brugeren fotograferede kasseres før produktet er gemt.

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type Stage = "stregkode" | "foto" | "ingredienser" | "naering";

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

// Tegner hele videobilledet (fuld opløsning, fuld ramme) — bevidst ingen
// beskæring til et fokusfelt, så det originale billede uden for fx
// stregkoden altid er med i det, der gemmes/analyseres.
function capturePhotoFromVideo(video: HTMLVideoElement | null): string | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function KameraOpretContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);

  const [stage, setStage] = useState<Stage>("stregkode");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState(t("cameraCreate.analyzingDefault"));
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeLookupFailed, setBarcodeLookupFailed] = useState(false);
  const [region, setRegion] = useState("DK");

  const draftRef = useRef<ProductCreateDraft>({
    sideImages: [undefined, undefined, undefined],
    analysisIds: {},
  });

  // Bruger-regionen er det primære sprogsignal (aldrig telefonens/browserens
  // visningssprog, jf. docs/DECISIONS.md 2026-09-12) — hentes én gang, før
  // stregkoden fastfryser den i draften.
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

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const goToCreatePage = useCallback(() => {
    sessionStorage.setItem(PRODUCT_DRAFT_STORAGE_KEY, JSON.stringify(draftRef.current));
    stopCamera();
    router.push("/product/create?fromFailedAdd=1");
  }, [router, stopCamera]);

  function storeBarcodeContext(code: string) {
    const context = buildBarcodeContext(code, region);
    draftRef.current.barcodeValue = context.barcode;
    draftRef.current.marketRegion = context.marketRegion;
    draftRef.current.gs1Prefix3 = context.gs1Prefix3 ?? undefined;
    draftRef.current.gs1Regions = context.gs1Regions;
    draftRef.current.primaryOcrLanguages = context.primaryOcrLanguages;
    return context;
  }

  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): gemmer
  // stregkode-fotoet i baggrunden, uden at blokere selve scan-flowet — samme
  // "productId udfyldes senere ved oprettelse"-mønster som forside/
  // ingredienser/næring. Fejl her må aldrig afbryde stregkode-flowet.
  function saveBarcodePhotoInBackground(photo: string, barcode: string, marketRegion: string) {
    fetch("/api/ai/save-barcode-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo, barcode, marketRegion }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { analysisId?: string } | null) => {
        if (data?.analysisId) {
          draftRef.current.analysisIds = { ...draftRef.current.analysisIds, barcode: data.analysisId };
        }
      })
      .catch(() => {});
  }

  const continueAfterUnknownBarcode = useCallback(
    (code: string) => {
      const cleaned = code.replace(/\D/g, "");
      if (!cleaned) return;
      const context = storeBarcodeContext(cleaned);
      const capturedPhoto = capturePhotoFromVideo(videoRef.current);
      draftRef.current.barcodeImage = capturedPhoto ?? draftRef.current.barcodeImage;
      if (capturedPhoto) saveBarcodePhotoInBackground(capturedPhoto, cleaned, context.marketRegion);
      lookupInProgressRef.current = false;
      setBarcodeLookupFailed(false);
      setAnalyzing(false);
      setPhoto(null);
      setCameraStatus("starting");
      setStage("foto");
      setRestartKey((key) => key + 1);
    },
    // region intentionally included: barcode context must freeze the market region at scan time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region],
  );

  const lookupBarcode = useCallback(
    async (code: string) => {
      const cleaned = code.replace(/\D/g, "");
      if (!cleaned || lookupInProgressRef.current) return;

      lookupInProgressRef.current = true;
      setAnalyzing(true);
      setBarcodeLookupFailed(false);
      setAnalyzingLabel(t("camera.lookingUp", { code: cleaned }));

      try {
        const response = await fetch(`/api/products/lookup/${encodeURIComponent(cleaned)}`);
        if (response.status === 404) {
          continueAfterUnknownBarcode(cleaned);
          return;
        }
        if (!response.ok) throw new Error("Barcode lookup failed");

        const data = (await response.json()) as { product: { id: string } };
        stopCamera();
        router.push(`/add/${data.product.id}`);
      } catch {
        // Vi har stadig en gyldig aflæst barcode. Vis fejl, men lad brugeren
        // fortsætte med netop den barcode i stedet for at kassere scan-data.
        const context = storeBarcodeContext(cleaned);
        const capturedPhoto = capturePhotoFromVideo(videoRef.current);
        draftRef.current.barcodeImage = capturedPhoto ?? undefined;
        if (capturedPhoto) saveBarcodePhotoInBackground(capturedPhoto, cleaned, context.marketRegion);
        setManualBarcode(cleaned);
        setBarcodeLookupFailed(true);
        setAnalyzing(false);
        lookupInProgressRef.current = false;
      }
    },
    // storeBarcodeContext intentionally omitted: it's a plain function, not
    // memoized, and re-deriving it every render would defeat this callback's
    // own memoization; region (its actual dependency) is already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [continueAfterUnknownBarcode, region, router, stopCamera, t],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }

      try {
        if (stage === "stregkode") {
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

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stage, restartKey, stopCamera, lookupBarcode]);

  function capturePhoto() {
    const dataUrl = capturePhotoFromVideo(videoRef.current);
    if (!dataUrl) return;
    setPhoto(dataUrl);
    stopCamera();
  }

  function retake() {
    setPhoto(null);
    setAnalyzing(false);
    setCameraStatus("starting");
    setRestartKey((key) => key + 1);
  }

  function nextStage(next: Stage) {
    setPhoto(null);
    setAnalyzing(false);
    setCameraStatus("starting");
    setStage(next);
    setRestartKey((key) => key + 1);
  }

  // FORSIDE: barcode er allerede fastlagt. Først billig OCR til duplicate-search,
  // derefter OpenAI Vision til brand/subbrand/product/variant. Midlertidig
  // dispensation (docs/DECISIONS.md, 2026-09-17): AI er her primær læser af
  // fotoet, ikke kun fallback — se samme note ved ingredienser/næring nedenfor.
  useEffect(() => {
    if (stage !== "foto" || !photo) return;
    let cancelled = false;

    async function analyze() {
      let shouldAdvance = true;
      setAnalyzing(true);
      setAnalyzingLabel(t("cameraCreate.readingImage"));
      const barcode = draftRef.current.barcodeValue;
      if (!barcode) return;
      const context = buildBarcodeContext(barcode, draftRef.current.marketRegion ?? region);

      try {
        const localOcr = await extractTextPrioritized(photo!, context.primaryOcrLanguages);
        if (cancelled) return;

        if (localOcr.text) {
          setAnalyzingLabel(t("cameraCreate.searchingDatabase"));
          const duplicateResponse = await fetch("/api/products/recognize-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: localOcr.text }),
          });
          if (duplicateResponse.ok) {
            const duplicate = (await duplicateResponse.json()) as { product: { id: string } | null };
            if (duplicate.product) {
              shouldAdvance = false;
              stopCamera();
              router.push(`/add/${duplicate.product.id}`);
              return;
            }
          }
        }

        setAnalyzingLabel(t("cameraCreate.analyzingWithAi"));
        const response = await fetch("/api/ai/analyze-product-front", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo,
            barcode,
            marketRegion: context.marketRegion,
          }),
        });
        const data = (await response.json()) as {
          analysisId: string | null;
          result: ProductFrontAnalysis | null;
        };
        if (cancelled) return;

        if (data.analysisId) {
          draftRef.current.analysisIds = { ...draftRef.current.analysisIds, front: data.analysisId };
        }
        if (data.result) {
          draftRef.current.brand = data.result.brand ?? undefined;
          draftRef.current.subbrand = data.result.subbrand ?? undefined;
          draftRef.current.name = data.result.productName ?? undefined;
          draftRef.current.variant = data.result.variant ?? undefined;
          draftRef.current.packageSizeText = data.result.packageSizeText ?? undefined;
        }
      } catch {
        // Bevar flowet: AI/OCR-fejl må ikke blokere manuel produkt-oprettelse.
      } finally {
        if (!cancelled && shouldAdvance) {
          draftRef.current.mainImage = photo!;
          nextStage("ingredienser");
        }
      }
    }

    void analyze();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, photo]);

  // INGREDIENSER: prioriteret lokal OCR sendes med som støtte, men AI læser
  // selve fotoet (midlertidig dispensation, docs/DECISIONS.md 2026-09-17 —
  // skal senere rulles tilbage til "lokal OCR først, AI kun fallback").
  useEffect(() => {
    if (stage !== "ingredienser" || !photo) return;
    let cancelled = false;

    async function analyze() {
      setAnalyzing(true);
      setAnalyzingLabel(t("cameraCreate.readingIngredients"));
      const barcode = draftRef.current.barcodeValue;
      if (!barcode) return;
      const context = buildBarcodeContext(barcode, draftRef.current.marketRegion ?? region);
      let localOcrText = "";

      try {
        const localOcr = await extractTextPrioritized(photo!, context.primaryOcrLanguages);
        if (cancelled) return;
        localOcrText = localOcr.text;

        const response = await fetch("/api/ai/extract-ingredients-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo,
            barcode,
            marketRegion: context.marketRegion,
            ocrText: localOcr.text,
          }),
        });
        const data = (await response.json()) as {
          analysisId: string | null;
          result: IngredientsAnalysis | null;
        };
        if (cancelled) return;

        if (data.analysisId) {
          draftRef.current.analysisIds = { ...draftRef.current.analysisIds, ingredients: data.analysisId };
        }
        draftRef.current.ingredientsText = data.result?.ingredientsText || localOcr.text || undefined;
      } catch {
        if (localOcrText) draftRef.current.ingredientsText = localOcrText;
      } finally {
        if (!cancelled) {
          draftRef.current.ingredientsImage = photo!;
          nextStage("naering");
        }
      }
    }

    void analyze();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, photo]);

  // NÆRING: lokal OCR/regex som sanity check + fallback, OpenAI vision som
  // primær struktureret aflæsning (samme midlertidige dispensation som
  // ingredienser ovenfor). OpenAI-værdier bruges når alle fire pr.-100g-felter
  // er udfyldt, ellers falder vi tilbage til lokal parse.
  useEffect(() => {
    if (stage !== "naering" || !photo) return;
    let cancelled = false;

    async function analyze() {
      setAnalyzing(true);
      setAnalyzingLabel(t("cameraCreate.readingNutrition"));
      const barcode = draftRef.current.barcodeValue;
      if (!barcode) return;
      const context = buildBarcodeContext(barcode, draftRef.current.marketRegion ?? region);

      let localParsed: ReturnType<typeof parseNutritionText> = null;

      try {
        const localOcr = await extractTextPrioritized(photo!, context.primaryOcrLanguages);
        localParsed = parseNutritionText(localOcr.text);

        setAnalyzingLabel(t("cameraCreate.analyzingWithAi"));
        const response = await fetch("/api/ai/extract-nutrition-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photo,
            barcode,
            marketRegion: context.marketRegion,
            ocrText: localOcr.text,
          }),
        });
        const data = (await response.json()) as {
          analysisId: string | null;
          result: NutritionAnalysis | null;
        };
        if (cancelled) return;

        if (data.analysisId) {
          draftRef.current.analysisIds = { ...draftRef.current.analysisIds, nutrition: data.analysisId };
        }

        const ai = data.result;
        const aiComplete =
          ai?.kcalPer100g != null &&
          ai.proteinPer100g != null &&
          ai.carbsPer100g != null &&
          ai.fatPer100g != null;

        const selected = aiComplete
          ? {
              kcalPer100g: ai!.kcalPer100g!,
              proteinPer100g: ai!.proteinPer100g!,
              carbsPer100g: ai!.carbsPer100g!,
              fatPer100g: ai!.fatPer100g!,
            }
          : localParsed;

        if (selected) {
          draftRef.current.kcalPer100g = String(selected.kcalPer100g);
          draftRef.current.proteinPer100g = String(selected.proteinPer100g);
          draftRef.current.carbsPer100g = String(selected.carbsPer100g);
          draftRef.current.fatPer100g = String(selected.fatPer100g);
        }
        if (ai?.alternativeServings?.length) {
          draftRef.current.alternativeServings = ai.alternativeServings;
        }
      } catch {
        if (localParsed) {
          draftRef.current.kcalPer100g = String(localParsed.kcalPer100g);
          draftRef.current.proteinPer100g = String(localParsed.proteinPer100g);
          draftRef.current.carbsPer100g = String(localParsed.carbsPer100g);
          draftRef.current.fatPer100g = String(localParsed.fatPer100g);
        }
      } finally {
        if (!cancelled) {
          draftRef.current.nutritionImage = photo!;
          goToCreatePage();
        }
      }
    }

    void analyze();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, photo]);

  function submitManualBarcode(event: React.FormEvent) {
    event.preventDefault();
    setBarcodeLookupFailed(false);
    void lookupBarcode(manualBarcode);
  }

  const message = cameraMessage(cameraStatus, t);
  const stageLabel =
    stage === "stregkode"
      ? t("cameraCreate.stageBarcode")
      : stage === "foto"
        ? t("cameraCreate.stagePhoto")
        : stage === "ingredienser"
          ? t("cameraCreate.stageIngredients")
          : t("cameraCreate.stageNutrition");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <p className="hf-type-caption text-center">{stageLabel}</p>

      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("camera.photoAlt")} className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            aria-label={t("camera.liveViewAriaLabel")}
          />
        )}

        {!photo && stage !== "stregkode" && (
          <div className="pointer-events-none absolute inset-[12%] rounded-[12px] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
        )}

        {!photo && stage === "stregkode" && (
          <div className="pointer-events-none absolute inset-[18%] border-2 border-white/80">
            <span className="absolute -inset-0.5 border-[6px] border-transparent border-t-hf-green" />
          </div>
        )}

        {message && (
          <div className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center">
            <p className="max-w-xs text-sm font-semibold text-white">{message}</p>
          </div>
        )}

        {analyzing && <ScanningOverlay label={analyzingLabel} />}
      </div>

      {stage === "stregkode" && !analyzing && (
        <div className="flex flex-col items-center gap-2 rounded-[8px] p-4" style={{ background: "var(--hf-color-card)" }}>
          <HfBarcodeIcon className="text-hf-black" />
          <p className="hf-type-caption text-center">
            {barcodeLookupFailed ? t("cameraCreate.barcodeLookupFailedContinue") : t("cameraCreate.showBarcodeHint")}
          </p>
          <form onSubmit={submitManualBarcode} className="flex w-full gap-2">
            <input
              value={manualBarcode}
              onChange={(event) => setManualBarcode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              aria-label={t("camera.barcodeNumberAriaLabel")}
              placeholder={t("camera.barcodeNumberAriaLabel")}
              className="min-w-0 flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none"
            />
            <button disabled={!manualBarcode} className="hf-btn-primary px-4 py-2 text-xs disabled:opacity-40">
              {t("camera.lookUp")}
            </button>
          </form>
          {barcodeLookupFailed && manualBarcode && (
            <button
              type="button"
              onClick={() => continueAfterUnknownBarcode(manualBarcode)}
              className="hf-btn-secondary w-full justify-center py-2 text-xs"
            >
              {t("cameraCreate.continueWithBarcode")}
            </button>
          )}
        </div>
      )}

      {stage !== "stregkode" && (
        <div className="flex justify-center py-1">
          {photo ? (
            !analyzing && (
              <button onClick={retake} className="hf-btn-secondary gap-2 px-5 py-3 text-sm">
                {t("camera.retakePhoto")}
              </button>
            )
          ) : (
            <button
              onClick={capturePhoto}
              disabled={cameraStatus !== "active"}
              className="hf-btn-primary gap-2 px-6 py-3 text-sm disabled:opacity-40"
            >
              <IconCamera size={19} /> {t("camera.takePhoto")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KameraOpretPage() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("cameraCreate.title")}>
      <Suspense fallback={null}>
        <KameraOpretContent />
      </Suspense>
    </HfScreen>
  );
}
