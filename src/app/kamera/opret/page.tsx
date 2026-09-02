"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCamera } from "@tabler/icons-react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { ChecksumException, FormatException, NotFoundException } from "@zxing/library";
import { HfScreen } from "@/components/HfScreen";
import { ScanningOverlay } from "@/components/hf/ScanningOverlay";
import { HfBarcodeIcon } from "@/components/hf/HfBarcodeIcon";
import { extractText, hasMeaningfulText, parseNutritionText } from "@/lib/product-ocr";
import { bestImageMatch } from "@/lib/image-similarity";
import { PRODUCT_DRAFT_STORAGE_KEY, type ProductCreateDraft } from "@/lib/product-draft";

// Guidet auto-genkendelsesflow: forsidefoto → (tekst-OCR-match eller
// billed-hash/AI-match) → stregkode → næringsdeklaration → opret-siden,
// forudfyldt fra det, der blev fundet undervejs. Selvstændig indgang/route,
// rører ikke de eksisterende /kamera-faner (Stregkode/Måltid/HelloFresh),
// jf. brugerens krav.

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type Stage = "foto" | "stregkode" | "naering";

function cameraMessage(status: CameraStatus) {
  if (status === "starting") return "Starter kameraet...";
  if (status === "denied") return "Giv HELLO CAL adgang til kameraet i browserens indstillinger.";
  if (status === "unavailable") return "Denne browser eller enhed har ikke et tilgængeligt kamera.";
  if (status === "error") return "Kameraet kunne ikke startes. Luk andre apps, der bruger kameraet, og prøv igen.";
  return null;
}

function statusFromCameraError(error: unknown): CameraStatus {
  if (!(error instanceof DOMException)) return "error";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
  if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
  return "error";
}

function capturePhotoFromVideo(video: HTMLVideoElement | null): string | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

function KameraOpretContent() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);

  const [stage, setStage] = useState<Stage>("foto");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState("Analyserer billedet...");
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeLookupFailed, setBarcodeLookupFailed] = useState(false);

  const draftRef = useRef<ProductCreateDraft>({ sideImages: [undefined, undefined, undefined] });

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
    router.push("/produkt/opret?fromFailedAdd=1");
  }, [router, stopCamera]);

  const lookupBarcode = useCallback(
    async (code: string) => {
      const cleaned = code.trim();
      if (!cleaned || lookupInProgressRef.current) return;
      lookupInProgressRef.current = true;
      setAnalyzing(true);
      setAnalyzingLabel(`Slår ${cleaned} op...`);
      try {
        const res = await fetch(`/api/products/lookup/${encodeURIComponent(cleaned)}`);
        if (res.status === 404) {
          draftRef.current.barcodeValue = cleaned;
          draftRef.current.barcodeImage = capturePhotoFromVideo(videoRef.current) ?? undefined;
          setStage("naering");
          setPhoto(null);
          setAnalyzing(false);
          setRestartKey((k) => k + 1);
          return;
        }
        if (!res.ok) throw new Error("Barcode lookup failed");
        const data = (await res.json()) as { product: { id: string } };
        stopCamera();
        router.push(`/tilfoej/${data.product.id}`);
      } catch {
        setBarcodeLookupFailed(true);
        setAnalyzing(false);
        lookupInProgressRef.current = false;
      }
    },
    [router, stopCamera]
  );

  // Kamera-bootstrap: almindelig getUserMedia til foto/næring-trin, ZXing
  // (samme bibliotek som /kamera?mode=produkt) til stregkode-trinnet.
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
            }
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
    setRestartKey((k) => k + 1);
  }

  // Trin 1: forsidefoto — tekst-OCR-match, ellers lokal billed-hash-match,
  // ellers AI-vision som sidste udvej. Fund redirecter direkte til
  // produktet; intet fund fortsætter til stregkode-trinnet.
  useEffect(() => {
    if (stage !== "foto" || !photo) return;
    let cancelled = false;

    async function analyze() {
      setAnalyzing(true);
      setAnalyzingLabel("Læser billedet...");
      try {
        const ocrText = await extractText(photo!);
        if (cancelled) return;

        if (hasMeaningfulText(ocrText)) {
          setAnalyzingLabel("Søger i databasen...");
          const res = await fetch("/api/products/recognize-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: ocrText }),
          });
          const data = (await res.json()) as { product: { id: string } | null };
          if (cancelled) return;
          if (data.product) {
            stopCamera();
            router.push(`/tilfoej/${data.product.id}`);
            return;
          }
          const guessedName = ocrText
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.length >= 3);
          if (guessedName) draftRef.current.name = guessedName.slice(0, 80);
        } else {
          setAnalyzingLabel("Sammenligner med kendte varer...");
          const candidatesRes = await fetch("/api/products/generic-candidates");
          const candidatesData = (await candidatesRes.json()) as {
            products: { id: string; name: string; imageUrl: string | null }[];
          };
          if (cancelled) return;
          const localMatch = await bestImageMatch(photo!, candidatesData.products, (c) => c.imageUrl, 0.85);
          if (localMatch) {
            stopCamera();
            router.push(`/tilfoej/${localMatch.candidate.id}`);
            return;
          }

          setAnalyzingLabel("Undersøger billedet med AI...");
          const aiRes = await fetch("/api/ai/recognize-product-photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo }),
          });
          const aiData = (await aiRes.json()) as {
            product: { id: string } | null;
            guess: { name: string | null; brand: string | null } | null;
          };
          if (cancelled) return;
          if (aiData.product) {
            stopCamera();
            router.push(`/tilfoej/${aiData.product.id}`);
            return;
          }
          if (aiData.guess?.name) draftRef.current.name = aiData.guess.name;
        }

        draftRef.current.mainImage = photo!;
        setStage("stregkode");
        setPhoto(null);
        setAnalyzing(false);
        setCameraStatus("starting");
        setRestartKey((k) => k + 1);
      } catch {
        if (cancelled) return;
        // Genkendelse fejlede helt (netværk/AI nede) — gå videre i stedet for
        // at brugeren står fast; masterdata udfyldes manuelt på opret-siden.
        draftRef.current.mainImage = photo!;
        setStage("stregkode");
        setPhoto(null);
        setAnalyzing(false);
        setCameraStatus("starting");
        setRestartKey((k) => k + 1);
      }
    }

    void analyze();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, photo]);

  // Trin 3: næringsdeklaration — regex-parsing lokalt, AI-vision kun hvis
  // regex ikke kan udlede alle fire pr.-100g-værdier. Herefter altid videre
  // til opret-siden (medmindre værdierne er ~identiske med et kendt produkt).
  useEffect(() => {
    if (stage !== "naering" || !photo) return;
    let cancelled = false;

    async function analyze() {
      setAnalyzing(true);
      setAnalyzingLabel("Læser næringsindholdet...");
      try {
        const ocrText = await extractText(photo!);
        if (cancelled) return;
        let parsed = parseNutritionText(ocrText);

        if (!parsed) {
          setAnalyzingLabel("Undersøger billedet med AI...");
          const aiRes = await fetch("/api/ai/extract-nutrition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo }),
          });
          const aiData = (await aiRes.json()) as { values: Record<string, number | null> | null };
          if (cancelled) return;
          const v = aiData.values;
          if (v && v.kcalPer100g != null && v.proteinPer100g != null && v.carbsPer100g != null && v.fatPer100g != null) {
            parsed = {
              kcalPer100g: v.kcalPer100g,
              proteinPer100g: v.proteinPer100g,
              carbsPer100g: v.carbsPer100g,
              fatPer100g: v.fatPer100g,
            };
          }
        }

        draftRef.current.nutritionImage = photo!;

        if (parsed) {
          setAnalyzingLabel("Tjekker for dublet...");
          const dedupeRes = await fetch("/api/products/match-nutrition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
          });
          const dedupeData = (await dedupeRes.json()) as { product: { id: string } | null };
          if (cancelled) return;
          if (dedupeData.product) {
            stopCamera();
            router.push(`/tilfoej/${dedupeData.product.id}`);
            return;
          }
          draftRef.current.kcalPer100g = String(parsed.kcalPer100g);
          draftRef.current.proteinPer100g = String(parsed.proteinPer100g);
          draftRef.current.carbsPer100g = String(parsed.carbsPer100g);
          draftRef.current.fatPer100g = String(parsed.fatPer100g);
        }

        goToCreatePage();
      } catch {
        if (cancelled) return;
        draftRef.current.nutritionImage = photo!;
        goToCreatePage();
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

  const message = cameraMessage(cameraStatus);
  const stageLabel =
    stage === "foto" ? "Foto af produkt" : stage === "stregkode" ? "Foto af stregkode" : "Foto af næringsindhold";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <p className="hf-type-caption text-center">{stageLabel}</p>

      <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-hf-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Dit fotograferede billede" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            aria-label="Live kameravisning"
          />
        )}

        {!photo && stage !== "stregkode" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
          </div>
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
            {barcodeLookupFailed
              ? "Stregkoden blev ikke genkendt. Prøv igen, eller indtast nummeret."
              : "Vis stregkoden for kameraet, eller indtast nummeret manuelt."}
          </p>
          <form onSubmit={submitManualBarcode} className="flex w-full gap-2">
            <input
              value={manualBarcode}
              onChange={(event) => setManualBarcode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Stregkodenummer"
              placeholder="Stregkodenummer"
              className="min-w-0 flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none"
            />
            <button disabled={!manualBarcode} className="hf-btn-primary px-4 py-2 text-xs disabled:opacity-40">
              Slå op
            </button>
          </form>
          <button onClick={goToCreatePage} className="hf-btn-secondary w-full justify-center py-2 text-xs">
            Spring over — opret produktet manuelt
          </button>
        </div>
      )}

      {stage !== "stregkode" && (
        <div className="flex justify-center py-1">
          {photo ? (
            !analyzing && (
              <button onClick={retake} className="hf-btn-secondary gap-2 px-5 py-3 text-sm">
                Tag billedet om
              </button>
            )
          ) : (
            <button
              onClick={capturePhoto}
              disabled={cameraStatus !== "active"}
              className="hf-btn-primary gap-2 px-6 py-3 text-sm disabled:opacity-40"
            >
              <IconCamera size={19} /> Tag billede
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KameraOpretPage() {
  return (
    <HfScreen title="Tilføj vare">
      <Suspense fallback={null}>
        <KameraOpretContent />
      </Suspense>
    </HfScreen>
  );
}
