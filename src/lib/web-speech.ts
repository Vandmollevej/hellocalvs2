// Tale ind (Web Speech API's SpeechRecognition) og tale ud (speechSynthesis)
// i browseren — én sætning ind ad gangen og én tekst ud ad gangen, så en
// stemmeguide kan skiftes til at tale og lytte. Bruges af Kropsmål-siden;
// native gør det samme via Device.recognizeSpeech/Device.speak.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function speechRecognitionSupported(): boolean {
  return recognitionConstructor() !== undefined;
}

export type RecognizeResult = { text: string | null; error?: "denied" | "unavailable" };

/**
 * Lytter, til brugeren holder en pause, og giver det sagte (null = intet hørt).
 * [signal] afbryder uden resultat.
 */
export function recognizeOnce(
  lang: string,
  onPartial: (text: string) => void,
  signal: AbortSignal,
): Promise<RecognizeResult> {
  const Recognition = recognitionConstructor();
  if (!Recognition) return Promise.resolve({ text: null, error: "unavailable" });
  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = "";
    let interim = "";
    let error: RecognizeResult["error"];
    let settled = false;
    // Ingen tale efter 12 sekunder → stop, som telefonernes egen genkendelse.
    const timeout = window.setTimeout(() => recognition.stop(), 12000);
    const settle = (result: RecognizeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => {
      recognition.onend = null;
      recognition.abort();
      settle({ text: null });
    };
    signal.addEventListener("abort", onAbort);

    recognition.onresult = (event) => {
      interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      onPartial(`${finalText}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") error = "denied";
      else if (event.error === "audio-capture" || event.error === "language-not-supported") error = "unavailable";
    };
    recognition.onend = () => {
      const text = `${finalText}${interim}`.trim();
      settle({ text: text || null, error: text ? undefined : error });
    };
    try {
      recognition.start();
    } catch {
      settle({ text: null, error: "unavailable" });
    }
  });
}

function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const language = lang.split("-")[0].toLowerCase();
  // "no" taler norsk bokmål ("nb") i de fleste stemmelister.
  const alternatives = language === "nb" ? ["nb", "no"] : [language];
  return (
    voices.find((voice) => voice.lang.toLowerCase().replace("_", "-") === lang.toLowerCase()) ??
    voices.find((voice) => alternatives.includes(voice.lang.toLowerCase().split(/[-_]/)[0]))
  );
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Siger [text] højt og venter, til stemmen er færdig (eller [signal] afbryder). */
export async function speak(text: string, lang: string, signal: AbortSignal): Promise<void> {
  if (!speechSynthesisSupported() || signal.aborted) return;
  const synth = window.speechSynthesis;
  // Én ytring pr. sætning: Chrome klipper lange ytringer af efter ca. 15 sekunder.
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  for (const sentence of sentences) {
    if (signal.aborted) return;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = lang;
      const voice = voiceFor(lang);
      if (voice) utterance.voice = voice;
      // Safari glemmer af og til onend — fortsæt efter den tid, sætningen højst tager.
      const fallback = window.setTimeout(done, 2500 + sentence.length * 110);
      function done() {
        window.clearTimeout(fallback);
        signal.removeEventListener("abort", onAbort);
        resolve();
      }
      function onAbort() {
        synth.cancel();
        done();
      }
      signal.addEventListener("abort", onAbort);
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
    });
  }
}
