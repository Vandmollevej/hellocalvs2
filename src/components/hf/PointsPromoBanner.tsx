"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

// Delt points-promo-kort, brugt hvor et grønt "optjen X points ved at..."-banner
// forekommer (Invitér en ven, Indberet fejl). Struktur er bevidst kopieret fra
// design.md §6.11-stilen: luk-X øverst til højre, fed overskrift og en
// fuldbredde-knap, jf. bruger-reference "Spar op til ... + Aktivér rabat"
// (HelloFresh privatlivspolitik-skærmbillede).
export function PointsPromoBanner({
  headline,
  subtext,
  href,
  buttonLabel = "Læs betingelser",
}: {
  headline: string;
  subtext?: string;
  href: string;
  buttonLabel?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative rounded-lg p-4" style={{ background: "var(--hf-color-brand)" }}>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Luk"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
        style={{ color: "var(--hf-color-white)" }}
      >
        <IconX size={20} />
      </button>
      <div className="pr-8">
        <p className="hf-type-body-sm font-bold" style={{ color: "var(--hf-color-white)" }}>
          {headline}
        </p>
        {subtext && (
          <p className="hf-type-caption mt-1" style={{ color: "var(--hf-color-white)" }}>
            {subtext}
          </p>
        )}
      </div>
      <a
        href={href}
        className="hf-btn-primary hf-type-button mt-3 flex h-12 w-full items-center justify-center"
        style={{ background: "var(--hf-color-white)", color: "var(--hf-color-action)" }}
      >
        {buttonLabel}
      </a>
    </div>
  );
}
