"use client";

import { useId, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Sammenklappelig række til desktop-skallen: i stedet for at navigere til en
// egen side åbner indholdet som dropdown på samme side (samme geometri som
// UpcomingGoalBar: tan overskriftsrække, creme indhold).
export function DropdownSection({
  title,
  detail,
  children,
  defaultOpen = false,
}: {
  title: string;
  /** Kort tekst i ikke-fed skrift til højre for titlen (fx seneste måling). */
  detail?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section className="overflow-hidden rounded-2xl bg-hf-tan">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="hf-control-row flex w-full items-center gap-2 px-4 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <span className="hf-type-body hf-type-strong min-w-0 flex-1 truncate text-hf-black">{title}</span>
        {detail && <span className="hf-type-small shrink-0 text-hf-black">{detail}</span>}
        <HfChevron direction={open ? "down" : "right"} className="text-hf-black" />
      </button>
      {open && (
        <div id={panelId} className="bg-hf-cream p-4">
          {children}
        </div>
      )}
    </section>
  );
}
