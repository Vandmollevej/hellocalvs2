// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24): AI'en returnerer ud
// over sine værdier også (1) det område af billedet, den faktisk har aflæst
// (bruges til at beskære billedet i redigerings-lightboxen), og (2) de
// områder, den var usikker på (rød ramme på billedet og ved det tilsvarende
// felt). Alle koordinater er normaliseret 0–1 i forhold til billedets bredde/
// højde, så de passer uanset visningsstørrelse. Gemmes i
// AiProductAnalysis.regions.

export type Box = { x: number; y: number; w: number; h: number };
export type UncertainRegion = Box & { field: string; reason: string };
export type AnalysisRegions = { ocrRegion: Box | null; uncertainRegions: UncertainRegion[] };

const BOX_PROPERTIES = {
  x: { type: "number" },
  y: { type: "number" },
  w: { type: "number" },
  h: { type: "number" },
};

// Flettes ind i en rutes strict JSON-schema (`properties` + `required`).
export const REGION_SCHEMA_PROPERTIES = {
  ocrRegion: {
    type: ["object", "null"],
    properties: BOX_PROPERTIES,
    required: ["x", "y", "w", "h"],
    additionalProperties: false,
  },
  uncertainRegions: {
    type: "array",
    items: {
      type: "object",
      properties: { field: { type: "string" }, reason: { type: "string" }, ...BOX_PROPERTIES },
      required: ["field", "reason", "x", "y", "w", "h"],
      additionalProperties: false,
    },
  },
};
export const REGION_SCHEMA_REQUIRED = ["ocrRegion", "uncertainRegions"];

export const REGION_PROMPT = [
  "Angiv også ocrRegion: det rektangel på billedet, du faktisk har aflæst (x, y, w, h som andele 0-1 af billedets bredde/højde, origo øverst til venstre), eller null.",
  "Angiv uncertainRegions: ét rektangel pr. felt, du ikke er helt sikker på, med field = feltets navn fra dette svar og en kort reason på dansk. Tom liste hvis du er sikker på alt.",
].join(" ");

function clamp01(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

function readBox(value: unknown): Box | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const x = clamp01(v.x);
  const y = clamp01(v.y);
  const w = clamp01(v.w);
  const h = clamp01(v.h);
  if (x === null || y === null || w === null || h === null || w === 0 || h === 0) return null;
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

// Læser (og validerer) regionerne fra et AI-svar eller en gemt
// AiProductAnalysis.regions — ugyldige rektangler droppes i stedet for at
// tegne en forkert ramme.
export function readRegions(value: unknown): AnalysisRegions {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const uncertainRegions = Array.isArray(v.uncertainRegions)
    ? v.uncertainRegions.flatMap((region) => {
        const box = readBox(region);
        if (!box) return [];
        const r = region as Record<string, unknown>;
        return [{ ...box, field: String(r.field ?? ""), reason: String(r.reason ?? "") }];
      })
    : [];
  return { ocrRegion: readBox(v.ocrRegion), uncertainRegions };
}
