export type OcrResult = {
  text: string;
  confidence: number;
  languages: string;
  // true = teksten er for usikker til at bruges (hverken som støtte til AI
  // eller som reserve-værdi). Test 2026-09-27: et helt kamerabillede med
  // baggrund (fliser/træ) gav volapyk med ~47 % sikkerhed.
  needsVisionFallback: boolean;
};

export type OcrOptions = {
  // Næringstabel/ingrediensliste: tesseracts "single column"-segmentering
  // bevarer tabelrækkerne (label + tal på samme linje). Test 2026-09-27:
  // 86-89 % sikkerhed mod 47-75 % med standard-segmenteringen.
  tableLayout?: boolean;
};

export async function extractTextPrioritized(
  imageDataUrl: string,
  primaryLanguages: string[],
  minimumConfidence = 72,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const { createWorker, PSM } = await import("tesseract.js");
  const languages = [...new Set(primaryLanguages.length ? primaryLanguages : ["dan", "eng"])].join("+");
  const worker = await createWorker(languages);
  try {
    if (options.tableLayout) await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const result = await worker.recognize(imageDataUrl);
    const text = result.data.text?.trim() ?? "";
    const confidence = Number(result.data.confidence ?? 0);
    const meaningfulChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;

    return {
      text,
      confidence,
      languages,
      needsVisionFallback: confidence < minimumConfidence || meaningfulChars < 4,
    };
  } finally {
    await worker.terminate();
  }
}

// Lokal OCR-tekst må kun sendes med som "støtte" til AI'en eller bruges som
// reserve, når den er læsbar — ellers får AI'en og brugeren volapyk.
export function usableOcrText(result: OcrResult | null | undefined): string {
  return result && !result.needsVisionFallback ? result.text : "";
}
