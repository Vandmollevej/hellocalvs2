"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";

// Et trin er klaret (brugerens krav 2026-10-14): hele kamerabilledet blinker
// kort hvidt (som iPhones skærmbillede), trinnets nummer og navn står stort
// midt i billedet, streges over, og et stort flueben sættes til højre. Så
// rykker linjen op og bliver lille, og det næste trins overskrift står stort
// øverst (ScanHeading). Timing: STEP_DONE_MS i ProductCaptureFlow = .hf-step-done i globals.css.
export type DoneStep = { number: number; title: string };

// Overstregningen kommer, når blinket er ved at være væk (text-decoration
// følger hver linje, også når en lang overskrift ombrydes).
const STRIKE_DELAY_MS = 220;

export function StepDoneOverlay({ steps, label }: { steps: DoneStep[]; label: string }) {
  const [struck, setStruck] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStruck(true), STRIKE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="hf-step-done pointer-events-none absolute inset-0 overflow-hidden" role="status" aria-label={label}>
      <div className="hf-step-done__flash" aria-hidden />
      <div className="hf-step-done__card">
        {steps.map((step) => (
          <div key={step.number} className="hf-step-done__row">
            <span className={`hf-step-done__title${struck ? " hf-step-done__title--struck" : ""}`}>
              {step.number}. {step.title}
            </span>
            <span className="hf-step-done__check">
              <IconCheck size={34} stroke={3} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
