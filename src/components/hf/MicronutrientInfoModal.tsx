"use client";

import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { MICRONUTRIENT_INFO_BY_KEY, micronutrientHref } from "@/lib/micronutrient-info";

// Info-popup for et vitamin/mineral i varesidens "Vis mere"-tabel — samme
// opbygning som AdditiveInfoModal for E-numre.
export function MicronutrientInfoModal({ nutrientKey, onClose }: { nutrientKey: string; onClose: () => void }) {
  const info = MICRONUTRIENT_INFO_BY_KEY[nutrientKey];
  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-hf-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-hf-black/10 bg-hf-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
          <p className="hf-type-body hf-heading text-hf-black">{info.name}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tilbage"
            className="flex h-7 w-7 items-center justify-center rounded-full text-hf-black"
          >
            <IconArrowLeft size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            <p className="hf-type-small text-text-secondary">{info.alsoKnownAs}</p>
            <p className="hf-type-body text-hf-black">{info.function}</p>
            <div>
              <p className="hf-type-small text-text-secondary hf-heading uppercase">Findes i</p>
              <p className="hf-type-body text-hf-black">{info.sources}</p>
            </div>
            <div>
              <p className="hf-type-small text-text-secondary hf-heading uppercase">Referenceindtag</p>
              <p className="hf-type-body text-hf-black">{info.referenceIntake}</p>
            </div>
            <Link
              href={micronutrientHref(info.key)}
              className="hf-type-small hf-heading text-hf-green underline underline-offset-2"
            >
              Se hele siden med kilder
            </Link>
          </div>
          <p className="hf-type-small text-text-secondary mt-4">
            Generel baggrundsinformation — ikke personlig kostrådgivning.
          </p>
        </div>
      </div>
    </div>
  );
}
