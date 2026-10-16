"use client";

import { useEffect, useRef, type RefObject } from "react";
import { sampleVideoCenter } from "@/lib/focus-detection";
import { BlackFrameTracker, MAX_CAMERA_RESTARTS, WATCHDOG_INTERVAL_MS, frameIsBlack } from "@/lib/camera-health";
import { scanLog } from "@/lib/scan-debug-log";

// Holder øje med, at kamerabilledet lever (docs/DECISIONS.md 2026-10-14):
// sporets mute/unmute/ended, siden i baggrunden/forgrunden, en video sat på
// pause og et helt sort billede. Alt logges i admin "Log" (brugerens
// spørgsmål "hvad var galt?" skal kunne besvares derfra), og et dødt kamera
// startes igen af sig selv — højst MAX_CAMERA_RESTARTS gange pr. flow.
export function useCameraWatchdog({
  videoRef,
  streamRef,
  enabled,
  flowId,
  step,
  onRestart,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  streamRef: RefObject<MediaStream | null>;
  enabled: boolean;
  flowId: string;
  step: string;
  onRestart: () => void;
}) {
  const restartsRef = useRef(0);
  const callbacks = useRef({ onRestart, step });
  useEffect(() => {
    callbacks.current = { onRestart, step };
  }, [onRestart, step]);

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    const track = stream.getVideoTracks()[0] ?? null;
    const canvas = document.createElement("canvas");
    const tracker = new BlackFrameTracker();
    let stopped = false;

    const state = () => ({
      step: callbacks.current.step,
      trackState: track?.readyState ?? null,
      trackMuted: track?.muted ?? null,
      trackEnabled: track?.enabled ?? null,
      videoPaused: video.paused,
      videoReadyState: video.readyState,
      videoSize: `${video.videoWidth}×${video.videoHeight}`,
      pageVisible: document.visibilityState === "visible",
      restarts: restartsRef.current,
    });

    const play = () => {
      void video.play().catch(() => {});
    };

    const restart = (reason: "black" | "ended") => {
      if (stopped) return;
      stopped = true;
      const exhausted = restartsRef.current >= MAX_CAMERA_RESTARTS;
      if (!exhausted) restartsRef.current += 1;
      scanLog(flowId, reason === "black" ? "camera_black" : "camera_ended", {
        level: "error",
        message:
          (reason === "black" ? "Kamerabilledet er helt sort" : "Kamerasporet er stoppet") +
          (exhausted ? " — genstartes ikke flere gange" : " — kameraet startes igen"),
        data: { ...state(), reason },
      });
      if (!exhausted) callbacks.current.onRestart();
    };

    const onMute = () =>
      scanLog(flowId, "camera_muted", { level: "warn", message: "Kamerasporet blev sat på pause af systemet", data: state() });
    const onUnmute = () => {
      scanLog(flowId, "camera_unmuted", { message: "Kamerasporet kører igen", data: state() });
      play();
    };
    const onEnded = () => restart("ended");
    const onPause = () => {
      if (document.visibilityState === "visible" && !stopped) play();
    };
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      scanLog(flowId, visible ? "page_visible" : "page_hidden", {
        level: visible ? "info" : "warn",
        message: visible ? "Appen tilbage i forgrunden" : "Appen lagt i baggrunden",
        data: state(),
      });
      tracker.reset();
      if (visible) play();
    };

    track?.addEventListener("mute", onMute);
    track?.addEventListener("unmute", onUnmute);
    track?.addEventListener("ended", onEnded);
    video.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onVisibility);

    const interval = setInterval(() => {
      if (stopped || document.visibilityState !== "visible") return;
      if (track && track.readyState === "ended") {
        restart("ended");
        return;
      }
      if (video.paused) play();
      const gray = sampleVideoCenter(video, canvas);
      if (tracker.push(gray ? frameIsBlack(gray) : false)) restart("black");
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
      track?.removeEventListener("mute", onMute);
      track?.removeEventListener("unmute", onUnmute);
      track?.removeEventListener("ended", onEnded);
      video.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, flowId, videoRef, streamRef]);
}
