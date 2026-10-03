export type OcrResult = {
  text: string;
  confidence: number;
  languages: string;
  // true = teksten er for usikker til at bruges (hverken som støtte til AI
  // eller som reserve-værdi). Test 2026-09-27: et helt kamerabillede med
  // baggrund (fliser/træ) gav volapyk med ~47 % sikkerhed.
  needsVisionFallback: boolean;
  // Kun med `layout: true`: hver tekstlinje med placering i billedet
  // (pixels), så feltet med næring/ingredienser kan findes og vises.
  lines?: OcrLine[];
};

export type OcrBox = { x0: number; y0: number; x1: number; y1: number };

export type OcrLine = {
  text: string;
  confidence: number;
  box: OcrBox;
  // Tesseracts tekstblok og afsnit — linjer i samme afsnit hører sammen.
  block: number;
  paragraph: number;
};

export type OcrOptions = {
  // Næringstabel/ingrediensliste: tesseracts "single column"-segmentering
  // bevarer tabelrækkerne (label + tal på samme linje). Test 2026-09-27:
  // 86-89 % sikkerhed mod 47-75 % med standard-segmenteringen.
  tableLayout?: boolean;
  layout?: boolean;
};

type TesseractBlock = {
  paragraphs?: { lines?: { text: string; confidence: number; bbox: OcrBox }[] }[];
};

function linesFromBlocks(blocks: TesseractBlock[] | null | undefined): OcrLine[] {
  const lines: OcrLine[] = [];
  (blocks ?? []).forEach((block, blockIndex) =>
    (block.paragraphs ?? []).forEach((paragraph, paragraphIndex) =>
      (paragraph.lines ?? []).forEach((line) => {
        const text = line.text?.trim() ?? "";
        if (text) {
          lines.push({
            text,
            confidence: Number(line.confidence ?? 0),
            box: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 },
            block: blockIndex,
            paragraph: paragraphIndex,
          });
        }
      }),
    ),
  );
  return lines;
}

type TesseractWorker = {
  setParameters(params: Record<string, unknown>): Promise<unknown>;
  recognize(image: string, options?: object, output?: object): Promise<{ data: Record<string, unknown> }>;
  terminate(): Promise<unknown>;
};

// Én tesseract-arbejder pr. sprogsæt genbruges mellem billederne (den
// levende scanning i kameraflowet læser op til ti billeder pr. trin, og en
// ny arbejder pr. billede kostede ~1 s hver gang). Skifter sprogsættet,
// lukkes den gamle. Kald i kø, så to aflæsninger aldrig deler arbejderen.
let cachedWorker: { languages: string; worker: Promise<TesseractWorker> } | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getWorker(languages: string): Promise<TesseractWorker> {
  if (cachedWorker && cachedWorker.languages === languages) return cachedWorker.worker;
  const previous = cachedWorker;
  cachedWorker = null;
  if (previous) void previous.worker.then((worker) => worker.terminate()).catch(() => {});
  const { createWorker } = await import("tesseract.js");
  const worker = (createWorker(languages) as unknown as Promise<TesseractWorker>).catch((error) => {
    if (cachedWorker?.worker === worker) cachedWorker = null;
    throw error;
  });
  cachedWorker = { languages, worker };
  return worker;
}

export async function extractTextPrioritized(
  imageDataUrl: string,
  primaryLanguages: string[],
  minimumConfidence = 72,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const run = async () => {
    const { PSM } = await import("tesseract.js");
    const languages = [...new Set(primaryLanguages.length ? primaryLanguages : ["dan", "eng"])].join("+");
    const worker = await getWorker(languages);
    // Segmenteringen sættes hver gang — arbejderen husker ellers sidste kald.
    await worker.setParameters({ tessedit_pageseg_mode: options.tableLayout ? PSM.SINGLE_COLUMN : PSM.AUTO });
    const result = options.layout
      ? await worker.recognize(imageDataUrl, {}, { text: true, blocks: true })
      : await worker.recognize(imageDataUrl);
    const text = (result.data.text as string | undefined)?.trim() ?? "";
    const confidence = Number(result.data.confidence ?? 0);
    const meaningfulChars = text.replace(/[^\p{L}\p{N}]/gu, "").length;

    return {
      text,
      confidence,
      languages,
      needsVisionFallback: confidence < minimumConfidence || meaningfulChars < 4,
      ...(options.layout ? { lines: linesFromBlocks(result.data.blocks as TesseractBlock[] | null) } : {}),
    };
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

// Lokal OCR-tekst må kun sendes med som "støtte" til AI'en eller bruges som
// reserve, når den er læsbar — ellers får AI'en og brugeren volapyk.
export function usableOcrText(result: OcrResult | null | undefined): string {
  return result && !result.needsVisionFallback ? result.text : "";
}
