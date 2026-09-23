"use client";

import { useId, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Fold-out group: tan header row + cream body, same geometry as the
// calendar's hour groups (src/app/calendar/page.tsx). Several may be open
// at once; each keeps its own open state.
export function AccordionSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
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
        className="flex w-full items-center gap-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <span className="flex-1 text-sm font-semibold text-hf-black">{title}</span>
        {typeof count === "number" && (
          <span className="text-xs text-hf-black opacity-60">{count}</span>
        )}
        <HfChevron direction={open ? "down" : "right"} className="text-hf-black" />
      </button>
      <div id={panelId} hidden={!open} className="bg-hf-cream p-3">
        {children}
      </div>
    </section>
  );
}
