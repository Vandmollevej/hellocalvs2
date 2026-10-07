"use client";

import { BottomSheet } from "@/components/hf/BottomSheet";
import type { ToxinInfo } from "@/lib/toxins";

// Samme opbygning som AdditiveInfoModal, men med de statiske data fra
// src/lib/toxins.ts og råd til gravide/ammende og fertilitet øverst.
export function ToxinInfoModal({ toxin, onClose }: { toxin: ToxinInfo; onClose: () => void }) {
  return (
    <BottomSheet ariaLabel={toxin.name} onClose={onClose}>
        <div className="p-4">
          <p className="hf-type-body hf-heading mb-3 text-hf-black">{toxin.name}</p>
          <div className="flex flex-col gap-3">
            <p className="hf-type-small text-text-secondary">{toxin.foods}</p>
            <p className="hf-type-body text-hf-black">{toxin.description}</p>
            {toxin.pregnancy && (
              <div className="rounded-xl bg-hf-tan px-3 py-2.5">
                <p className="hf-type-small text-text-secondary hf-heading uppercase">
                  Gravid eller ammende
                </p>
                <p className="hf-type-body text-hf-black">{toxin.pregnancy}</p>
              </div>
            )}
            {toxin.fertility && (
              <div className="rounded-xl bg-hf-tan px-3 py-2.5">
                <p className="hf-type-small text-text-secondary hf-heading uppercase">
                  Når du prøver at blive gravid
                </p>
                <p className="hf-type-body text-hf-black">{toxin.fertility}</p>
              </div>
            )}
            <div>
              <p className="hf-type-small text-text-secondary hf-heading uppercase">Råd</p>
              <p className="hf-type-body text-hf-black">{toxin.advice}</p>
            </div>
            {toxin.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="hf-type-small text-hf-green underline underline-offset-2"
              >
                {link.label}
              </a>
            ))}
          </div>
          <p className="hf-type-small text-text-secondary mt-4">
            Vist fordi indholdsfortegnelsen nævner en fødevare, der er kendt for stoffet — ikke en
            måling af netop denne vare. Generel information fra Fødevarestyrelsen og EFSA, ikke
            personlig kostrådgivning.
          </p>
        </div>
    </BottomSheet>
  );
}
