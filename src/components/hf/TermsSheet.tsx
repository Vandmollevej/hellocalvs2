"use client";

import { useState } from "react";
import Link from "next/link";
import { IconFileText } from "@tabler/icons-react";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { HfChevron } from "@/components/hf/HfChevron";
import { termsHref, type TermsHint } from "@/lib/terms-hints";

// "Vilkår og betingelser"-bjælken nederst på startguidens trin,
// abonnementssiderne og integrationssiderne (docs/DECISIONS.md 2026-09-27,
// forbillede: HelloFreshs bestillingsflow). Tryk åbner bundarket
// (KRAV.md "Bundark") i halv skærmhøjde med sidens egen, scrollbare
// vilkårstekst og et link til det relevante afsnit i /betingelser.
// Cirkelknappen er design.md §6.7's 32 × 32 terms-action.

export type TermsSheetLabels = { title: string; goTo: string };

const DEFAULT_LABELS: TermsSheetLabels = {
  title: "Vilkår og betingelser",
  goTo: "Gå til vilkår og betingelser",
};

export function TermsSheet({ hint, labels = DEFAULT_LABELS }: { hint: TermsHint; labels?: TermsSheetLabels }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TermsBar open={false} title={labels.title} onToggle={() => setOpen(true)} />
      {open && (
        <BottomSheet
          size="half"
          ariaLabel={labels.title}
          onClose={() => setOpen(false)}
          footer={
            <Link href={termsHref(hint.anchor)} className="hf-type-body-sm self-end text-hf-black hf-type-strong">
              {labels.goTo}
            </Link>
          }
        >
          <div className="sticky top-0 bg-hf-cream px-4">
            <SheetBar title={labels.title} />
          </div>
          <div className="flex flex-col gap-3 px-6 pb-2">
            {hint.paragraphs.map((paragraph, index) => (
              <p key={index} className="hf-type-body-sm">
                {paragraph}
              </p>
            ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}

// Bjælken øverst i arket lukker det med arkets glid-ud-animation.
function SheetBar({ title }: { title: string }) {
  const close = useBottomSheetClose();
  return <TermsBar open title={title} onToggle={close} />;
}

function TermsBar({ open, title, onToggle }: { open: boolean; title: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex h-12 w-full shrink-0 items-center gap-3 px-2 text-left text-hf-black"
    >
      <IconFileText size={24} stroke={1.75} aria-hidden="true" className="shrink-0" />
      <span className="hf-type-body min-w-0 flex-1 hf-type-strong">{title}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-hf-black">
        <HfChevron direction={open ? "down" : "up"} compact />
      </span>
    </button>
  );
}
