"use client";

import { useEffect, useState } from "react";
import type { SubscriptionTier } from "@/lib/subscription";

// Klientens syn på abonnementsniveau til Seriøs-låste funktioner
// (docs/DECISIONS.md 2026-09-26). Hentes én gang pr. sideindlæsning og deles
// mellem alle komponenter; serveren håndhæver selv grænserne, hvor data
// ellers kunne hentes udenom.

let cached: Promise<SubscriptionTier> | null = null;

function fetchTier(): Promise<SubscriptionTier> {
  if (!cached) {
    cached = fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { tier?: SubscriptionTier } | null) => json?.tier ?? "FREE")
      .catch(() => {
        cached = null;
        return "FREE" as SubscriptionTier;
      });
  }
  return cached;
}

/** null mens niveauet hentes. */
export function useSubscriptionTier(): SubscriptionTier | null {
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  useEffect(() => {
    let active = true;
    fetchTier().then((value) => {
      if (active) setTier(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return tier;
}

export function useIsSerious(): boolean | null {
  const tier = useSubscriptionTier();
  return tier === null ? null : tier === "SERIOUS";
}
