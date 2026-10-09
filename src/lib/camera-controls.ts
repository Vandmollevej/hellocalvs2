// Lygte og fokus på kamerasporet (docs/DECISIONS.md 2026-10-02). Browserne
// tilbyder kun det, telefonen og browseren selv understøtter: Chrome på
// Android har typisk lygte, fokus-tilstand og fokusafstand; Safari på iPhone
// har ofte ingen af delene. Alt er derfor feature-detekteret — mangler en
// funktion, sker der intet, og knappen vises ikke. Dybdesensor/LiDAR er ikke
// tilgængelig fra en web-app.

// Ikke med i TypeScripts DOM-typer (Media Capture Image-specifikationen).
type ExtendedCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  focusDistance?: { min: number; max: number; step?: number };
};

export type CameraControls = {
  torch: boolean;
  continuousFocus: boolean;
  // Fokusafstand i meter (specifikationens enhed), når den kan låses manuelt.
  focusDistance: { min: number; max: number } | null;
};

// Stregkoden holdes ca. 20 cm fra kameraet.
export const BARCODE_FOCUS_DISTANCE_M = 0.2;

export function readCameraControls(track: MediaStreamTrack | null | undefined): CameraControls {
  const none: CameraControls = { torch: false, continuousFocus: false, focusDistance: null };
  if (!track || typeof track.getCapabilities !== "function") return none;
  let capabilities: ExtendedCapabilities;
  try {
    capabilities = track.getCapabilities() as ExtendedCapabilities;
  } catch {
    return none;
  }
  const modes = capabilities.focusMode ?? [];
  const range = capabilities.focusDistance;
  return {
    torch: capabilities.torch === true,
    continuousFocus: modes.includes("continuous"),
    focusDistance:
      modes.includes("manual") && range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.max > range.min
        ? { min: range.min, max: range.max }
        : null,
  };
}

async function applyAdvanced(track: MediaStreamTrack, constraint: Record<string, unknown>): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [constraint as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

export function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  return applyAdvanced(track, { torch: on });
}

export function setContinuousFocus(track: MediaStreamTrack, controls: CameraControls): Promise<boolean> {
  if (!controls.continuousFocus) return Promise.resolve(false);
  return applyAdvanced(track, { focusMode: "continuous" });
}

// Stregkode-trinnet: automatisk eksponering/hvidbalance løbende, så en skygge
// på emballagen ikke efterlader stregerne under- eller overeksponeret. Ukendte
// felter ignoreres af kameraet, og fejl er harmløse.
export function setScanExposure(track: MediaStreamTrack): Promise<boolean> {
  return applyAdvanced(track, { exposureMode: "continuous", whiteBalanceMode: "continuous" });
}

// Låser fokus på en fast afstand (meter), begrænset til kameraets område.
export function lockFocusDistance(track: MediaStreamTrack, controls: CameraControls, meters: number): Promise<boolean> {
  const range = controls.focusDistance;
  if (!range) return Promise.resolve(false);
  const distance = Math.min(range.max, Math.max(range.min, meters));
  return applyAdvanced(track, { focusMode: "manual", focusDistance: distance });
}
