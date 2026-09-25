"use client";

// Henter brugerens registreringer med G3-klassifikation
// (src/lib/food-classification.ts). Ældre registreringer uden klassifikation
// udfyldes først én gang via /api/registrations/classify i boksen.

import { useEffect, useState } from "react";
import { localApi } from "@/lib/vault/local-api";
import type { SourceRegistration } from "@/lib/food-classification";

export async function loadSourceRegistrations(): Promise<SourceRegistration[]> {
  const fetchAll = async () => {
    const response = await localApi("/api/registrations");
    if (!response.ok) throw new Error("Kunne ikke hente registreringer");
    return ((await response.json()) as { registrations: SourceRegistration[] }).registrations;
  };
  const registrations = await fetchAll();
  if (!registrations.some((r) => r.classification === undefined)) return registrations;
  const classify = await localApi("/api/registrations/classify", { method: "POST" }).catch(() => null);
  const updated = classify?.ok ? ((await classify.json()) as { updated: number }).updated : 0;
  return updated > 0 ? fetchAll() : registrations;
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
