"use client";

import type { FabSide } from "./AddButton";

export function OnboardingSpotlight({
  side,
  onLater,
}: {
  side: FabSide;
  onLater: () => void;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          [side]: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 80,
          height: 190,
          borderRadius: side === "left" ? "0 190px 190px 0" : "190px 0 0 190px",
          boxShadow: "0 0 0 9999px rgba(20,20,18,0.6)",
          zIndex: 40,
        } as React.CSSProperties}
      />

      <div
        role="dialog"
        aria-label="Onboarding"
        className="absolute z-50 rounded-2xl bg-hf-tan p-4 shadow-lg"
        style={{ left: 16, right: 16, top: "calc(100% + 12px)" }}
      >
        <p className="text-sm font-medium text-hf-black">
          Tryk her for at tilføje din første registrering — med kamera, mikrofon eller søgning.
        </p>
        <button
          onClick={onLater}
          className="mt-3 text-sm font-bold text-hf-black underline underline-offset-2"
        >
          Vis senere
        </button>
      </div>
    </>
  );
}
