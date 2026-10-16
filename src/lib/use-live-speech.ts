"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Lytter løbende (Web Speech API, interim-resultater) og giver det sagte, mens
// det bliver sagt, så Madvarer kan søge og raffinere listen i realtid i stedet
// for at vente på en transskription bagefter. Native gør det samme via
// CaptureHooks.recordSpeech.

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type LiveSpeechPhase = "idle" | "listening" | "error" | "unsupported";
export type LiveSpeechError = "denied" | "noSpeech" | "interrupted" | "couldNotStart";

export function useLiveSpeech(onText: (text: string) => void) {
  const [phase, setPhase] = useState<LiveSpeechPhase>("idle");
  const [error, setError] = useState<LiveSpeechError | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback((lang: string) => {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      setPhase("unsupported");
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    let failed = false;
    // Hændelser fra en afbrudt (gammel) session ignoreres.
    const isCurrent = () => recognitionRef.current === recognition;
    finalRef.current = "";
    setError(null);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (isCurrent()) setPhase("listening");
    };
    recognition.onresult = (event) => {
      if (!isCurrent()) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalRef.current += `${result[0].transcript} `;
        else interim += result[0].transcript;
      }
      onTextRef.current(`${finalRef.current}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (!isCurrent()) return;
      failed = true;
      recognitionRef.current = null;
      setPhase("error");
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "denied"
          : event.error === "no-speech"
            ? "noSpeech"
            : "interrupted",
      );
    };
    recognition.onend = () => {
      if (!isCurrent()) return;
      recognitionRef.current = null;
      if (!failed) setPhase("idle");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setPhase("error");
      setError("couldNotStart");
    }
  }, []);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.abort();
    },
    [],
  );

  return { phase, error, start, stop };
}
