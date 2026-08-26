"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { IconCamera, IconRefresh } from "@tabler/icons-react";
import { BrowserMultiFormatOneDReader, type IScannerControls } from "@zxing/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";

type CameraStatus = "starting" | "active" | "denied" | "unavailable" | "error";
type LookupStatus = "idle" | "loading" | "not_found" | "error";

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

function KameraContent() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") === "maaltid" ? "maaltid" : "produkt";
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lookupInProgressRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("starting");
  const [restartKey, setRestartKey] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [photo, setPhoto] = useState<string | null>(null);

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
      router.push(`/tilfoej/${data.product.id}`);
    } catch {
      setLookupStatus("error");
      lookupInProgressRef.current = false;
    }
  }, [router, stopCamera]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setCameraStatus("unavailable");
        return;
      }

      try {
        if (mode === "produkt") {
          const reader = new BrowserMultiFormatOneDReader(undefined, {
            delayBetweenScanAttempts: 250,
            delayBetweenScanSuccess: 1000,
          });
          const controls = await reader.decodeFromConstraints(
            { audio: false, video: { facingMode: { ideal: "environment" } } },
            videoRef.current,
            (result) => {
              if (result && !lookupInProgressRef.current) void lookupBarcode(result.getText());
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
    setRestartKey((key) => key + 1);
  }

  function submitManualBarcode(event: React.FormEvent) {
    event.preventDefault();
    void lookupBarcode(barcode);
  }

  const message = cameraMessage(cameraStatus);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-hf-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Dit fotograferede måltid" className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label="Live kameravisning" />
        )}

        {!photo && mode === "maaltid" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square w-[68%] rounded-full border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
          </div>
        )}

        {!photo && mode === "produkt" && (
          <div className="pointer-events-none absolute inset-[18%] border-2 border-white/80">
            <span className="absolute -inset-0.5 border-[6px] border-transparent border-t-hf-green" />
          </div>
        )}

        {message && (
          <div className="absolute inset-0 flex items-center justify-center bg-hf-black/75 p-6 text-center">
            <p className="max-w-xs text-sm font-semibold text-white">{message}</p>
          </div>
        )}

        {cameraStatus === "active" && !photo && (
          <p className="absolute inset-x-4 top-4 rounded-full bg-hf-black/60 px-4 py-2 text-center text-xs font-semibold text-white">
            {mode === "produkt" ? "Hold stregkoden inden for rammen" : "Placér tallerkenen i cirklen"}
          </p>
        )}
      </div>

      {mode === "maaltid" ? (
        <div className="flex justify-center py-1">
          {photo ? (
            <button onClick={restartCamera} className="hf-btn-secondary gap-2 px-5 py-3 text-sm">
              <IconRefresh size={18} /> Tag billedet om
            </button>
          ) : (
            <button onClick={capturePhoto} disabled={cameraStatus !== "active"} className="hf-btn-primary gap-2 px-6 py-3 text-sm disabled:opacity-40">
              <IconCamera size={19} /> Tag billede
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-hf-tan p-4">
          <p className="mb-2 text-xs text-hf-black opacity-70">
            {lookupStatus === "loading"
              ? `Slår ${barcode} op...`
              : lookupStatus === "not_found"
                ? "Stregkoden blev læst, men produktet blev ikke fundet. Prøv en anden kode."
                : lookupStatus === "error"
                  ? "Stregkoden blev læst, men produktopslaget fejlede. Prøv igen."
                  : "Kameraet scanner automatisk. Du kan også indtaste nummeret under stregkoden."}
          </p>
          <form onSubmit={submitManualBarcode} className="flex gap-2">
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Stregkodenummer"
              placeholder="Stregkodenummer"
              className="min-w-0 flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none"
            />
            <button disabled={!barcode || lookupStatus === "loading"} className="hf-btn-primary px-4 py-2 text-xs disabled:opacity-40">
              Slå op
            </button>
          </form>
          {cameraStatus !== "active" && cameraStatus !== "starting" && (
            <button onClick={restartCamera} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-hf-black underline">
              <IconRefresh size={15} /> Prøv kameraet igen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KameraPage() {
  return (
    <HfScreen title="Kamera">
      <Suspense fallback={null}>
        <KameraContent />
      </Suspense>
    </HfScreen>
  );
}
