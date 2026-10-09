"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconCamera } from "@tabler/icons-react";
import { ProductCaptureFlow } from "@/components/camera/ProductCaptureFlow";
import { RESCAN_POINTS, type RescanStep } from "@/lib/product-rescan-offer";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Scan varen igen" (docs/DECISIONS.md 2026-10-02). Banneret glider ned under
// headeren, så snart /add/[id] ser, at varen kommer fra Open Food Facts/USDA
// eller mangler et fritlagt PNG. Det ligger OVEN PÅ siden —
// indholdet rykker aldrig ned.
// - "peek": grøn stribe "Optjen 10 points" + kamera-ikon og trækstregen.
// - "open": træk ned / tryk på stregen: teksten øverst, derefter samme kamera
//   som ved produktoprettelse med felterne nedenunder.
// - "mini": swipe op: kun et lille hvidt felt med stregen (midt for), så
//   del-ikonet i højre hjørne stadig kan nås.
// - "thanks": efter indsendelse, forsvinder af sig selv.

type BannerState = "hidden" | "peek" | "open" | "mini" | "thanks" | "gone";

// Så langt skal man trække, før banneret skifter tilstand.
const DRAG_THRESHOLD_PX = 30;
// Et tryk (ikke et træk) bevæger sig højst så meget.
const TAP_SLOP_PX = 6;
const THANKS_VISIBLE_MS = 4000;

function Handle({ tone }: { tone: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      className="block h-1 w-10 rounded-full"
      style={{ background: tone === "light" ? "rgba(255,255,255,0.75)" : "var(--hf-gray)" }}
    />
  );
}

export function RescanBanner({
  productId,
  barcode,
  steps,
  onSubmitted,
}: {
  productId: string;
  barcode: string;
  steps: RescanStep[];
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<BannerState>("hidden");
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null);

  // Glider ind lige efter første tegning, så animationen kan ses.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setState("peek"));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Første visning registreres: scanner ingen varen igen, læser den natlige
  // robot Open Food Facts-billedet med OpenAI (job "external-image-ai").
  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(productId)}/rescan/offer`, { method: "POST" }).catch(() => {});
  }, [productId]);

  useEffect(() => {
    if (state !== "thanks") return;
    const timer = setTimeout(() => setState("gone"), THANKS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "gone") return null;

  function settle(delta: number) {
    const tap = Math.abs(delta) <= TAP_SLOP_PX;
    setState((current) => {
      if (tap) return current === "open" ? "peek" : current === "mini" ? "peek" : current === "peek" ? "open" : current;
      if (delta > DRAG_THRESHOLD_PX) return current === "mini" ? "peek" : current === "peek" ? "open" : current;
      if (delta < -DRAG_THRESHOLD_PX) return current === "open" ? "peek" : current === "peek" ? "mini" : current;
      return current;
    });
  }

  const dragHandlers = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      dragRef.current = { startY: event.clientY, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Kun en antydning af bevægelsen — tilstanden skifter ved slip.
      setDragY(Math.max(-40, Math.min(40, (event.clientY - drag.startY) / 2)));
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragY(0);
      if (!drag || drag.pointerId !== event.pointerId) return;
      settle(event.clientY - drag.startY);
    },
    onPointerCancel() {
      dragRef.current = null;
      setDragY(0);
    },
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        settle(0);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        settle(DRAG_THRESHOLD_PX + 1);
      } else if (event.key === "ArrowUp" || event.key === "Escape") {
        event.preventDefault();
        settle(-(DRAG_THRESHOLD_PX + 1));
      }
    },
  };

  const dragging = dragY !== 0;
  const transform = state === "hidden" ? "translateY(-110%)" : `translateY(${dragY}px)`;
  const transition = dragging ? "none" : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";
  const handleLabel =
    state === "open" ? t("rescan.collapse") : state === "mini" ? t("rescan.restore") : t("rescan.expand");

  return (
    <>
      {state === "open" && (
        <button
          type="button"
          aria-label={t("rescan.collapse")}
          onClick={() => setState("peek")}
          className="absolute inset-0 z-30 bg-hf-overlay"
        />
      )}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-center ${
          state === "open" ? "bottom-0" : ""
        }`}
        style={{ transform, transition }}
      >
        {state === "mini" ? (
          <button
            type="button"
            aria-label={handleLabel}
            className="pointer-events-auto flex h-5 w-[72px] touch-none items-center justify-center rounded-b-[12px] shadow-md bg-hf-white"
            {...dragHandlers}
          >
            <Handle tone="dark" />
          </button>
        ) : state === "open" ? (
          <div
            className="pointer-events-auto flex w-full flex-col rounded-b-[16px] shadow-lg bg-hf-page max-h-[calc(100%-24px)]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <p className="hf-type-body hf-type-strong text-hf-black">
                {t("rescan.headline", { points: RESCAN_POINTS })}
              </p>
              <p className="hf-type-small text-text-secondary mt-1 mb-4">
                {t(steps.includes("nutrition") ? "rescan.hintFull" : "rescan.hintFront")}
              </p>
              <ProductCaptureFlow
                returnSuffix=""
                rescan={{
                  productId,
                  barcode,
                  steps,
                  onSubmitted: () => {
                    setState("thanks");
                    onSubmitted();
                  },
                }}
              />
            </div>
            <button
              type="button"
              aria-label={handleLabel}
              className="flex h-8 shrink-0 touch-none items-center justify-center"
              {...dragHandlers}
            >
              <Handle tone="dark" />
            </button>
          </div>
        ) : (
          <div
            role={state === "thanks" ? "status" : "button"}
            tabIndex={state === "thanks" ? undefined : 0}
            aria-label={state === "thanks" ? undefined : handleLabel}
            aria-live="polite"
            className="pointer-events-auto flex w-full touch-none select-none flex-col items-center gap-2 rounded-b-[16px] px-4 pt-3 pb-2 shadow-md bg-hf-brand text-hf-white"
            {...(state === "thanks" ? {} : dragHandlers)}
          >
            <span className="hf-type-body hf-type-strong flex items-center gap-2 text-center">
              {state === "thanks" ? (
                t("rescan.thanks", { points: RESCAN_POINTS })
              ) : (
                <>
                  {t("rescan.peek", { points: RESCAN_POINTS })}
                  <IconCamera size={20} stroke={1.8} aria-hidden="true" />
                </>
              )}
            </span>
            {state !== "thanks" && <Handle tone="light" />}
          </div>
        )}
      </div>
    </>
  );
}
