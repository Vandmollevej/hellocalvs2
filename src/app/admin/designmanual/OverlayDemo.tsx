"use client";

import { useState } from "react";
import { IconChevronRight, IconInfoCircle, IconShieldLock, IconX } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton, BottomSheetDots } from "@/components/hf/BottomSheet";
import { OverlayCloseControl, OverlayDisableToggle, useDisableCountdown } from "@/components/hf/OverlayFrameControls";

// Live eksempler til designmanualen: åbner de godkendte overlay-typer
// (bundarket — standard for screen-overlays/popups, KRAV.md "Bundark" —
// fuldskærms-overlay som StartupTipOverlay og centreret dialog på scrim),
// så admin kan se dem i den rigtige størrelse og opførsel.
export function OverlayDemo() {
  const [open, setOpen] = useState<"sheet" | "fullscreen" | "dialog" | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen("sheet")} className="hf-btn-primary h-12 px-4">
          Åbn bundark
        </button>
        <button type="button" onClick={() => setOpen("fullscreen")} className="hf-btn-primary h-12 px-4">
          Åbn fuldskærms-overlay
        </button>
        <button type="button" onClick={() => setOpen("dialog")} className="hf-btn-secondary h-12 px-4">
          Åbn dialog på scrim
        </button>
      </div>
      {open === "sheet" && <SheetDemo onClose={() => setOpen(null)} />}
      {open === "fullscreen" && <FullscreenDemo onClose={() => setOpen(null)} />}
      {open === "dialog" && <DialogDemo onClose={() => setOpen(null)} />}
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

function FullscreenDemo({ onClose }: { onClose: () => void }) {
  const disable = useDisableCountdown(onClose);
  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-hf-cream" role="dialog" aria-modal="true" aria-labelledby="dm-overlay-title">
      <div className="flex justify-end px-4 pt-9">
        <OverlayCloseControl label="Luk" counting={disable.counting} secondsLeft={disable.secondsLeft} onClose={onClose} />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-hf-tan text-hf-green">
          <IconShieldLock size={40} stroke={1.6} />
        </span>
        <h2 id="dm-overlay-title" className="hf-type-page-title">
          Overskrift på overlay
        </h2>
        <p className="hf-type-body max-w-sm">
          Ikon, titel og tekst i midten. &quot;Luk&quot; øverst til højre og &quot;Slå fra&quot; nederst til højre.
        </p>
      </div>
      <div className="flex justify-end px-4 pb-8">
        <OverlayDisableToggle label="Slå fra" enabled={disable.enabled} onChange={disable.setEnabled} />
      </div>
    </div>
  );
}

function DialogDemo({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--hf-color-overlay)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dm-dialog-title"
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-hf-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
          <p id="dm-dialog-title" className="hf-type-body-lg hf-heading flex items-center gap-2 text-hf-black">
            <IconInfoCircle size={20} /> Dialog-titel
          </p>
          <button type="button" onClick={onClose} aria-label="Luk" className="hf-btn-icon text-hf-black">
            <IconX size={22} />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <p className="hf-type-body">
            Hvid flade, 12 px radius og 16 px padding på en mørk scrim (--hf-color-overlay). Klik udenfor lukker.
          </p>
          <button type="button" onClick={onClose} className="hf-btn-primary h-12 w-full px-4">
            Forstået
          </button>
        </div>
      </div>
    </div>
  );
}
