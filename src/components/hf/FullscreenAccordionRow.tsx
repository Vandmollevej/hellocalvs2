"use client";

import { HfChevron } from "@/components/hf/HfChevron";

// Item 1 (2026-09-02): an accordion row that, when expanded, overlays the
// full screen from the top instead of expanding inline — and collapses back
// to its closed position in the list. Used for sections whose content is
// simple enough to live inline (no dedicated route), e.g. "Profil".
export function FullscreenAccordionRow({
  icon,
  label,
  open,
  onOpenChange,
  divider = true,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left ${
          divider ? "border-b border-hf-tan-dark" : ""
        }`}
      >
        <span className="text-hf-black">{icon}</span>
        <span className="flex-1 text-[15px] font-medium text-hf-black">{label}</span>
        <HfChevron className="text-hf-black" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[65] flex flex-col bg-hf-cream"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
            <button
              type="button"
              aria-label="Luk"
              onClick={() => onOpenChange(false)}
              className="flex h-11 w-11 items-center justify-center text-hf-black"
            >
              <HfChevron direction="left" />
            </button>
            <span className="text-[20px] font-bold text-hf-black">{label}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8">{children}</div>
        </div>
      )}
    </>
  );
}
