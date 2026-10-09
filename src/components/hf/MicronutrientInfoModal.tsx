"use client";

import Link from "next/link";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { MICRONUTRIENT_INFO_BY_KEY, micronutrientHref } from "@/lib/micronutrient-info";

// Info-popup for et vitamin/mineral i varesidens "Vis mere"-tabel — samme
// opbygning som AdditiveInfoModal for E-numre.
export function MicronutrientInfoModal({ nutrientKey, onClose }: { nutrientKey: string; onClose: () => void }) {
  const info = MICRONUTRIENT_INFO_BY_KEY[nutrientKey];
  if (!info) return null;

  return (
    <BottomSheet ariaLabel={info.name} onClose={onClose}>
        <div className="p-4">
          <p className="hf-type-body hf-heading mb-3 text-hf-black">{info.name}</p>
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
    </BottomSheet>
  );
}
