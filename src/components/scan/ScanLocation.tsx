"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { IconMapPinOff } from "@tabler/icons-react";

// Hele Oprettelses-appen spærres uden lokation (brugerbeslutning 2026-09-24,
// docs/OPRETTELSES-APP.md "E"): vi følger positionen løbende, og hvert
// billede/oprettelse sendes med de præcise koordinater.

export type ScanPosition = { latitude: number; longitude: number; accuracyM: number | null };

type LocationState =
  | { status: "waiting" }
  | { status: "denied" | "unavailable" }
  | { status: "ok"; position: ScanPosition };

const LocationContext = createContext<ScanPosition | null>(null);

export function useScanPosition() {
  return useContext(LocationContext);
}

export function ScanLocationGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>(() =>
    typeof navigator !== "undefined" && !navigator.geolocation ? { status: "unavailable" } : { status: "waiting" },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          status: "ok",
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          },
        }),
      (error) => setState({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [attempt]);

  if (state.status === "ok") {
    return <LocationContext.Provider value={state.position}>{children}</LocationContext.Provider>;
  }

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-hf-cream p-4 text-center">
      <IconMapPinOff size={48} stroke={1.6} aria-hidden="true" />
      <h1 className="hf-type-page-title">
        {state.status === "waiting" ? "Finder din placering…" : "Slå lokation til"}
      </h1>
      <p className="hf-type-body">
        {state.status === "waiting"
          ? "Appen kan kun bruges, når lokation er slået til."
          : "Oprettelses-appen kræver lokation, fordi hvert billede gemmes med butikkens placering. Tillad lokation for denne side i telefonens indstillinger og prøv igen."}
      </p>
      {state.status !== "waiting" && (
        <button type="button" className="hf-btn-primary h-12 w-full" onClick={() => setAttempt((n) => n + 1)}>
          <span className="hf-type-button">Prøv igen</span>
        </button>
      )}
    </div>
  );
}
