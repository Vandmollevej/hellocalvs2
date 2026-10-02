"use client";

// Henter brugerens registreringer med G3-klassifikation
// (src/lib/food-classification.ts). Serveren beregner klassifikationen.

import { useEffect, useState } from "react";
import type { SourceRegistration } from "@/lib/food-classification";

export async function loadSourceRegistrations(): Promise<SourceRegistration[]> {
  const response = await fetch("/api/registrations");
  if (!response.ok) throw new Error("Kunne ikke hente registreringer");
  return ((await response.json()) as { registrations: SourceRegistration[] }).registrations;
}

/** enabled=false venter med at hente (fx mens Seriøs-niveauet hentes). */
export function useSourceRegistrations(enabled = true) {
  const [registrations, setRegistrations] = useState<SourceRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadSourceRegistrations()
      .then((result) => {
        if (!cancelled) setRegistrations(result);
      })
      .catch(() => {
        if (!cancelled) setRegistrations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { registrations, loading };
}
