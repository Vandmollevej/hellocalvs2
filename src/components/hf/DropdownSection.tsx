"use client";

import { useId, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Sammenklappelig række til desktop-skallen: i stedet for at navigere til en
// egen side åbner indholdet som dropdown på samme side (samme geometri som
// UpcomingGoalBar: tan overskriftsrække, creme indhold).
export function DropdownSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
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
        <span className="hf-type-body hf-type-strong flex-1 text-hf-black">{title}</span>
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
