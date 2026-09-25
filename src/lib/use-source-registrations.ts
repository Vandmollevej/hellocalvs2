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

export function useSourceRegistrations() {
  const [registrations, setRegistrations] = useState<SourceRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return { registrations, loading };
}
