"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

// Delt points-promo-kort, brugt hvor et grønt "optjen X points ved at..."-banner
// forekommer (Invitér en ven, Indberet fejl). Grønt kort med luk-X, overskrift
// der starter med "*", og under kortet en grå "* Læs betingelser"-linje.
// Betingelserne er aldrig en stor knap (brugerbeslutning 2026-09-25,
// design.md §6.11).
export function PointsPromoBanner({
  headline,
  subtext,
  href,
  linkLabel = "Læs betingelser",
}: {
  headline: string;
  subtext?: string;
  href: string;
  linkLabel?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg p-4" style={{ background: "var(--hf-color-brand)" }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Luk"
          className="hf-btn-icon absolute right-1 top-1"
          style={{ color: "var(--hf-color-white)" }}
        >
          <IconX size={20} />
        </button>
        <div className="pr-8">
          <p className="hf-type-body" style={{ color: "var(--hf-color-white)" }}>
            *{headline}
          </p>
          {subtext && (
            <p className="hf-type-caption mt-1" style={{ color: "var(--hf-color-white)" }}>
              {subtext}
            </p>
          )}
        </div>
      </div>
      <a href={href} className="hf-type-caption self-start">
        * {linkLabel}
      </a>
    </div>
  );
}
