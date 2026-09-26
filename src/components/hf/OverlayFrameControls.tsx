"use client";

import { useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";

// Shared "Luk" / "Slå fra" controls for the full-screen overlays (start-up
// tips, Oplevelse af søvn). "Slå fra" is plain text with an on/off switch to
// its right, on by default. Switching it off does not close the overlay at
// once: "Luk" turns into a circular countdown 3–1, then the overlay is turned
// off and closed. Switching it back on during the countdown cancels it.
const COUNTDOWN_SECONDS = 3;

export function useDisableCountdown(onDisable: () => void) {
  const [enabled, setEnabled] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const onDisableRef = useRef(onDisable);
  useEffect(() => {
    onDisableRef.current = onDisable;
  });

  useEffect(() => {
    if (enabled) return;
    if (secondsLeft <= 0) {
      onDisableRef.current();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [enabled, secondsLeft]);

  function setEnabledAndReset(value: boolean) {
    setEnabled(value);
    setSecondsLeft(COUNTDOWN_SECONDS);
  }

  return { enabled, setEnabled: setEnabledAndReset, counting: !enabled, secondsLeft };
}

export function OverlayCloseControl({
  label,
  counting,
  secondsLeft,
  onClose,
}: {
  label: string;
  counting: boolean;
  secondsLeft: number;
  onClose: () => void;
}) {
  if (!counting) {
    return (
      <button type="button" onClick={onClose} className="hf-type-body hf-type-strong py-2 text-hf-black">
        {label}
      </button>
    );
  }

  const shown = Math.max(secondsLeft, 1);
  return (
    <span className="relative flex size-10 items-center justify-center text-hf-black" role="timer" aria-live="polite">
      <svg className="absolute inset-0" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <circle
          key={shown}
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={COUNTDOWN_SECONDS}
          strokeDasharray={COUNTDOWN_SECONDS}
          strokeDashoffset={COUNTDOWN_SECONDS - shown}
          transform="rotate(-90 20 20)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from={COUNTDOWN_SECONDS - shown}
            to={COUNTDOWN_SECONDS - shown + 1}
            dur="1s"
            fill="freeze"
          />
        </circle>
      </svg>
      <span className="hf-type-body hf-type-strong">{shown}</span>
    </span>
  );
}

export function OverlayDisableToggle({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-3 py-2">
      <span className="hf-type-body text-hf-black">{label}</span>
      <Toggle checked={enabled} onChange={onChange} ariaLabel={label} />
    </span>
  );
}
