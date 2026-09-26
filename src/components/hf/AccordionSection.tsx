"use client";

import { useId, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Fold-out group: tan header row + cream body, same geometry as the
// calendar's hour groups (src/app/calendar/page.tsx). Several may be open
// at once; each keeps its own open state.
export function AccordionSection({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  // Valgfrit ikon foran overskriften (sort).
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-2xl bg-hf-tan">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          {icon && <span className="flex shrink-0 text-hf-black">{icon}</span>}
          <span className="hf-type-body hf-type-strong flex-1 text-hf-black">{title}</span>
          {typeof count === "number" && (
            <span className="hf-type-small text-text-secondary">{count}</span>
          )}
          <HfChevron direction={open ? "down" : "right"} className="text-hf-black" />
        </button>
      </div>
      <div id={panelId} hidden={!open} className="bg-hf-cream p-3">
        {children}
      </div>
    </section>
  );
}
