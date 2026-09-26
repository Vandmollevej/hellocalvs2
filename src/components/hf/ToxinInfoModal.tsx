"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import type { ToxinInfo } from "@/lib/toxins";

// Samme opbygning som AdditiveInfoModal, men med de statiske data fra
// src/lib/toxins.ts og råd til gravide/ammende og fertilitet øverst.
export function ToxinInfoModal({ toxin, onClose }: { toxin: ToxinInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-hf-black/10 bg-hf-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
          <p className="hf-heading text-[15px] text-hf-black">{toxin.name}</p>
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
            <p className="text-[13px] text-hf-black opacity-70">{toxin.foods}</p>
            <p className="text-[14px] leading-relaxed text-hf-black">{toxin.description}</p>
            {toxin.pregnancy && (
              <div className="rounded-xl bg-hf-tan px-3 py-2.5">
                <p className="hf-heading text-[12px] uppercase text-hf-black opacity-50">
                  Gravid eller ammende
                </p>
                <p className="text-[14px] leading-relaxed text-hf-black">{toxin.pregnancy}</p>
              </div>
            )}
            {toxin.fertility && (
              <div className="rounded-xl bg-hf-tan px-3 py-2.5">
                <p className="hf-heading text-[12px] uppercase text-hf-black opacity-50">
                  Når du prøver at blive gravid
                </p>
                <p className="text-[14px] leading-relaxed text-hf-black">{toxin.fertility}</p>
              </div>
            )}
            <div>
              <p className="hf-heading text-[12px] uppercase text-hf-black opacity-50">Råd</p>
              <p className="text-[14px] leading-relaxed text-hf-black">{toxin.advice}</p>
            </div>
            {toxin.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-hf-green underline underline-offset-2"
              >
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-hf-black opacity-50">
            Vist fordi indholdsfortegnelsen nævner en fødevare, der er kendt for stoffet — ikke en
            måling af netop dette produkt. Generel information fra Fødevarestyrelsen og EFSA, ikke
            personlig kostrådgivning.
          </p>
        </div>
      </div>
    </div>
  );
}
