"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import type { ToxinInfo } from "@/lib/toxins";

// Samme opbygning som AdditiveInfoModal, men med de statiske data fra
// src/lib/toxins.ts og råd til gravide/ammende og fertilitet øverst.
export function ToxinInfoModal({ toxin, onClose }: { toxin: ToxinInfo; onClose: () => void }) {
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
          <p className="hf-type-body hf-heading text-hf-black">{toxin.name}</p>
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
            måling af netop dette produkt. Generel information fra Fødevarestyrelsen og EFSA, ikke
            personlig kostrådgivning.
          </p>
        </div>
      </div>
    </div>
  );
}
