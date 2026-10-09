"use client";

import { useState } from "react";
import { IconChevronRight, IconInfoCircle } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton, BottomSheetDots } from "@/components/hf/BottomSheet";

// Live eksempel til designmanualen: åbner bundarket — den eneste godkendte
// overlay-type (KRAV.md "Bundark", ejerens regel 2026-10-07: popups vises
// aldrig som fuldskærms-overlay eller centreret dialog) — så admin kan se det
// i den rigtige størrelse og opførsel.
export function OverlayDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen(true)} className="hf-btn-primary h-12 px-4">
          Åbn bundark
        </button>
      </div>
      {open && <SheetDemo onClose={() => setOpen(false)} />}
    </>
  );
}

function SheetDemo({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  return (
    <BottomSheet
      size="full"
      ariaLabel="Bundark"
      onClose={onClose}
      footer={
        <>
          <div className="relative flex h-10 items-center justify-center">
            <BottomSheetDots count={4} active={index} label={`Side ${index + 1} af 4`} onSelect={setIndex} />
            {index < 3 && (
              <button
                type="button"
                onClick={() => setIndex(index + 1)}
                aria-label="Næste side"
                className="absolute right-[20%] flex size-10 items-center justify-center text-hf-black"
              >
                <IconChevronRight size={24} />
              </button>
            )}
          </div>
          <BottomSheetCloseButton className="hf-control hf-btn-primary mt-4 w-full">Primær handling</BottomSheetCloseButton>
          <BottomSheetCloseButton className="hf-bottom-sheet__skip">Spring over</BottomSheetCloseButton>
        </>
      }
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
        <span className="flex size-40 items-center justify-center rounded-full bg-hf-tan text-hf-green">
          <IconInfoCircle size={72} stroke={1.4} />
        </span>
        <h2 className="hf-type-page-title text-center">Overskrift i bundark</h2>
        <p className="hf-type-body-lg">
          Træk i stregen for oven: et hurtigt swipe ned lukker arket, et langsomt træk under 30 % glider tilbage.
        </p>
      </div>
    </BottomSheet>
  );
}
