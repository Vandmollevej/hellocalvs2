"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  firstGuideIndex,
  formatSpokenValue,
  guideStep,
  startGuide,
  voiceLanguageTag,
  type VoiceLine,
} from "@/lib/body-measurement-voice";
import { recognizeOnce, speak, speechRecognitionSupported } from "@/lib/web-speech";

export type VoicePhase = "idle" | "speaking" | "listening";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const subscribeNever = () => () => {};

type StartOptions = {
  /** De synlige mål i sidens rækkefølge. */
  fields: readonly string[];
  /** Har målet allerede et tal i dag? Guiden starter ved det første uden. */
  isFilled: (field: string) => boolean;
  unit: "cm" | "in";
};

/**
 * Stemmeguiden på Kropsmål: siger, hvilket mål der skal bruges og hvordan man
 * måler, lytter efter tallet, gemmer det via [onSave] og siger det tilbage.
 * Logikken (hvad der siges og gemmes) ligger i src/lib/body-measurement-voice.ts.
 */
export function useBodyMeasurementVoice({
  locale,
  t,
  onSave,
}: {
  locale: string;
  t: Translate;
  onSave: (field: string, value: number) => void;
}) {
  // Kun i browseren (server-render: ingen mikrofon).
  const supported = useSyncExternalStore(subscribeNever, speechRecognitionSupported, () => false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [spoken, setSpoken] = useState("");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const lineText = useCallback(
    (line: VoiceLine, unit: "cm" | "in") =>
      t(`bodyMeasurements.voice.${line.key}`, {
        target: line.field ? t(`bodyMeasurements.voice.target.${line.field}`) : "",
        value: line.value != null ? formatSpokenValue(line.value, locale) : "",
        unit: t(unit === "in" ? "bodyMeasurements.voice.unitIn" : "bodyMeasurements.voice.unitCm"),
      }),
    [locale, t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setCurrentField(null);
  }, []);

  const start = useCallback(
    async ({ fields, isFilled, unit }: StartOptions) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      const lang = voiceLanguageTag(locale);
      setError(null);
      setHeard("");

      let step = startGuide(fields, firstGuideIndex(fields, isFilled));
      while (!signal.aborted) {
        if (step.save) onSaveRef.current(step.save.field, step.save.value);
        setCurrentField(step.done ? null : (step.state.fields[step.state.index] ?? null));
        const text = step.say.map((line) => lineText(line, unit)).join(" ");
        setSpoken(text);
        setPhase("speaking");
        await speak(text, lang, signal);
        if (step.done || signal.aborted) break;

        setPhase("listening");
        setHeard("");
        const result = await recognizeOnce(lang, setHeard, signal);
        if (signal.aborted) break;
        if (result.error === "denied" || result.error === "unavailable") {
          setError(t(result.error === "denied" ? "bodyMeasurements.voice.micDenied" : "bodyMeasurements.voice.unsupported"));
          break;
        }
        setHeard(result.text ?? "");
        step = guideStep(step.state, result.text, unit);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPhase("idle");
        setCurrentField(null);
      }
    },
    [lineText, locale, t],
  );

  return { supported, active: phase !== "idle", phase, currentField, spoken, heard, error, start, stop };
}
