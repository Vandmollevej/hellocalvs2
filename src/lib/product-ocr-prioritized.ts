export type OcrResult = {
  text: string;
  confidence: number;
  languages: string;
  needsVisionFallback: boolean;
};

export async function extractTextPrioritized(
  imageDataUrl: string,
  primaryLanguages: string[],
  minimumConfidence = 72,
): Promise<OcrResult> {
  const { recognize } = await import("tesseract.js");
  const languages = [...new Set(primaryLanguages.length ? primaryLanguages : ["dan", "eng"])].join("+");
  const result = await recognize(imageDataUrl, languages);
  const text = result.data.text?.trim() ?? "";
  const confidence = Number(result.data.confidence ?? 0);
  const meaningfulChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;

  return {
    text,
    confidence,
    languages,
    needsVisionFallback: confidence < minimumConfidence || meaningfulChars < 4,
  };
}
