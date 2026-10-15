import type { DetectedLabel } from "./product-label-ai.ts";

// Hvilke fotos det natlige mærkat-job læser pr. vare, og hvordan fund fra
// flere fotos lægges sammen (src/lib/product-label-scan.ts). Ren logik.

// Højst så mange fotos pr. vare (ét OpenAI-kald pr. foto).
export const MAX_PHOTOS_PER_PRODUCT = 5;

export type SourceProduct = {
  imageUrl: string | null;
  pendingImageUrl: string | null;
  aiAnalyses: { id: string; kind: string; imageUrl: string | null; prediction: unknown }[];
};

export type PhotoSource = { url: string; analysisId: string | null; side: "front" | "other" };

function packageStep(prediction: unknown): string | null {
  const step = (prediction as { step?: unknown } | null)?.step;
  return typeof step === "string" ? step : null;
}

// Forsiden: originalfotoet fra kamera-flowet er bedst (skarpt og i fuld
// opløsning), ellers varens billede (Open Food Facts som sidste udvej). Dertil
// alle sider af varen: helbillederne, stregkodefotoet og energi-/indholds-
// fotoet, når trinnet intet helbillede har (fx fra den native app, hvis fotos
// ikke beskæres).
export function pickSources(product: SourceProduct): PhotoSource[] {
  const analyses = product.aiAnalyses.filter((a) => a.imageUrl);
  const sources: PhotoSource[] = [];
  const add = (url: string | null, analysisId: string | null, side: PhotoSource["side"]) => {
    if (url && !sources.some((s) => s.url === url)) sources.push({ url, analysisId, side });
  };
  const front = analyses.find((a) => a.kind === "FRONT");
  if (front) add(front.imageUrl, front.id, "front");
  else add(product.imageUrl ?? product.pendingImageUrl, null, "front");
  const packages = analyses.filter((a) => a.kind === "PACKAGE");
  for (const photo of packages) add(photo.imageUrl, photo.id, packageStep(photo.prediction) === "front" ? "front" : "other");
  const barcode = analyses.find((a) => a.kind === "BARCODE");
  if (barcode) add(barcode.imageUrl, barcode.id, "other");
  for (const kind of ["NUTRITION", "INGREDIENTS"]) {
    const step = kind === "NUTRITION" ? "nutrition" : "ingredients";
    if (packages.some((p) => packageStep(p.prediction) === step)) continue;
    const photo = analyses.find((a) => a.kind === kind);
    if (photo) add(photo.imageUrl, photo.id, "other");
  }
  return sources.slice(0, MAX_PHOTOS_PER_PRODUCT);
}

export type SourcedLabel = DetectedLabel & { sourceUrl: string; analysisId: string | null };

// Samme mærke på flere fotos: det sikreste fund vinder, og et fund med boks
// (til fritskrabningen) foretrækkes ved samme sikkerhed.
export function mergeSourcedLabels(labels: SourcedLabel[]): SourcedLabel[] {
  const byKey = new Map<string, SourcedLabel>();
  for (const label of labels) {
    const current = byKey.get(label.key);
    if (!current || label.confidence > current.confidence || (label.confidence === current.confidence && label.box && !current.box)) {
      byKey.set(label.key, label);
    }
  }
  return [...byKey.values()];
}
