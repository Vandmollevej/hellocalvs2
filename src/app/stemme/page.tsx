"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconChevronUp, IconMinus, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Item = {
  id: string;
  title: string;
  kcal: number;
  amountLabel: string;
  protein: number;
  carbs: number;
  fat: number;
  image?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoicePhase = "idle" | "listening" | "processing" | "review" | "approved" | "error" | "unsupported";

function getSpeechRecognition() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

const initialItems: Item[] = [
  { id: "1", title: "Rugbrød", kcal: 180, amountLabel: "2 skiver", protein: 6, carbs: 28, fat: 2, image: "/dummy/rugbroed.png" },
  { id: "2", title: "Smør", kcal: 35, amountLabel: "8 g", protein: 0, carbs: 0, fat: 4 },
  { id: "3", title: "Roastbeef", kcal: 90, amountLabel: "40 g", protein: 12, carbs: 0, fat: 4 },
];

function StandMicrophone() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <rect x="22" y="5" width="20" height="31" rx="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M15 27v2a17 17 0 0 0 34 0v-2M32 46v10M22 57h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 14h10M27 21h10M27 28h10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MacroBar({ label, grams, max }: { label: string; grams: number; max: number }) {
  const pct = Math.min(100, (grams / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <span className="min-w-[36px] text-right text-base font-bold text-hf-black">{grams} g</span>
      </div>
      <div className="relative flex h-5 items-center">
        <div className="relative h-1 w-full rounded bg-hf-tan-dark">
          <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white" style={{ left: `${pct}%`, top: "50%" }} />
      </div>
    </div>
  );
}

function VoiceItem({ item, open, onToggle, onChange }: { item: Item; open: boolean; onToggle: () => void; onChange: (changes: Partial<Item>) => void }) {
  return (
    <li className="border-b border-hf-tan-dark last:border-b-0">
      <div className="flex items-center gap-2.5 py-2.5">
        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image} alt="" className="h-full w-full object-contain" />
          )}
        </div>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate text-sm font-semibold text-hf-black">{item.title}</span>
          <span className="mt-0.5 block text-xs text-hf-black opacity-60">{item.amountLabel}</span>
        </button>
        <span className="text-xs text-hf-black opacity-60">{item.kcal} kcal</span>
        <button type="button" onClick={onToggle} aria-label={open ? "Luk redigering" : `Rediger ${item.title}`} className="flex h-9 w-9 items-center justify-center rounded-full">
          {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </button>
      </div>

      {open && (
        <div className="mb-3 rounded-2xl bg-hf-tan p-4">
          <label className="block text-xs font-bold text-hf-black">
            Madvare eller ret
            <input value={item.title} onChange={(event) => onChange({ title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-hf-tan-dark bg-hf-white px-3 py-2.5 text-sm font-normal outline-none focus:border-hf-green" />
          </label>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[13px] text-hf-black opacity-70">Mængde</span>
            <div className="flex items-center gap-2">
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-white" aria-label="Mindre mængde"><IconMinus size={14} /></button>
              <input value={item.amountLabel} onChange={(event) => onChange({ amountLabel: event.target.value })} aria-label="Mængde" className="w-[74px] rounded-lg border border-hf-tan-dark bg-hf-white px-2 py-1.5 text-center text-sm outline-none focus:border-hf-green" />
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-white" aria-label="Større mængde"><IconPlus size={14} /></button>
            </div>
          </div>

          <p className="hf-heading mb-4 mt-5 text-[15px] text-hf-black">Energifordeling</p>
          <div className="flex flex-col gap-4">
            <MacroBar label="Protein" grams={item.protein} max={30} />
            <MacroBar label="Kulhydrat" grams={item.carbs} max={40} />
            <MacroBar label="Fedt" grams={item.fat} max={20} />
          </div>
        </div>
      )}
    </li>
  );
}

export default function StemmePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState(initialItems);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const processingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (processingTimerRef.current) window.clearTimeout(processingTimerRef.current);
    };
  }, []);

  const isListening = phase === "listening";
  const isProcessing = phase === "processing";
  const approved = phase === "approved";

  function finishProcessing() {
    setPhase("processing");
    processingTimerRef.current = window.setTimeout(() => setPhase("review"), 900);
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setPhase("unsupported");
      return;
    }

    if (processingTimerRef.current) window.clearTimeout(processingTimerRef.current);
    const recognition = new SpeechRecognition();
    let recognitionFailed = false;

    finalTranscriptRef.current = "";
    setTranscript("");
    setErrorMessage(null);
    setOpenId(null);

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "da-DK";
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setPhase("listening");
    recognition.onresult = (event) => {
      let interimTranscript = "";
      let newFinalTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) newFinalTranscript += `${result[0].transcript} `;
        else interimTranscript += result[0].transcript;
      }

      if (newFinalTranscript) finalTranscriptRef.current += newFinalTranscript;
      setTranscript(`${finalTranscriptRef.current}${interimTranscript}`.trim());
    };
    recognition.onerror = (event) => {
      recognitionFailed = true;
      recognitionRef.current = null;
      setPhase("error");
      setErrorMessage(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Mikrofonadgang blev afvist. Tillad mikrofonen i browserens indstillinger og prøv igen."
          : event.error === "no-speech"
            ? "Jeg hørte ingen tale. Prøv igen og tal tættere på mikrofonen."
            : "Talegenkendelsen blev afbrudt. Prøv igen."
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!recognitionFailed) finishProcessing();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setPhase("error");
      setErrorMessage("Mikrofonen kunne ikke startes. Prøv igen.");
    }
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    setPhase("processing");
    recognitionRef.current.stop();
  }

  function updateItem(id: string, changes: Partial<Item>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  return (
    <HfScreen title={isListening ? "Lytter..." : "Stemme"}>
      <div className="flex flex-col px-4 pb-6 pt-5">
        <section className="flex flex-col items-center" aria-live="polite">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || approved || phase === "unsupported"}
            aria-label={isListening ? "Stop mikrofonen" : "Start mikrofonen"}
            className="relative flex h-24 w-24 items-center justify-center disabled:cursor-default"
          >
            {(isListening || isProcessing) && <span className="absolute inset-0 animate-ping rounded-full bg-hf-green opacity-20 motion-reduce:animate-none" />}
            <span className={`relative flex h-20 w-20 items-center justify-center rounded-full text-hf-white shadow-sm ${phase === "unsupported" ? "bg-hf-gray" : "bg-hf-green"}`}>
              {approved ? <IconCheck size={44} stroke={2.5} /> : <StandMicrophone />}
            </span>
          </button>
          <p className="mt-2 text-xs font-bold text-hf-green">
            {approved
              ? "Godkendt"
              : isListening
                ? "Lytter — tryk for at stoppe"
                : isProcessing
                  ? "Gør teksten klar..."
                  : phase === "review"
                    ? "Klar til godkendelse"
                    : phase === "unsupported"
                      ? "Talegenkendelse understøttes ikke"
                      : "Tryk på mikrofonen for at tale"}
          </p>
          {errorMessage && <p className="mt-2 max-w-[310px] text-center text-xs leading-4 text-red-700">{errorMessage}</p>}
        </section>

        <section className="mt-4">
          <label htmlFor="voice-transcript" className="hf-heading text-sm text-hf-black">Det hørte jeg</label>
          <textarea id="voice-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Din tale vises her..." rows={3} className="mt-2 w-full resize-none rounded-2xl border border-hf-tan-dark bg-hf-white px-4 py-3 text-sm leading-5 text-hf-black outline-none focus:border-hf-green" />
          <p className="mt-1.5 text-xs text-hf-black opacity-55">Teksten opdateres løbende, mens du taler.</p>
        </section>

        <section className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="hf-heading text-base text-hf-black">Fundet i din tale</h2>
            <span className="text-xs text-hf-black opacity-55">Tryk for at redigere</span>
          </div>
          <ul>
            {items.map((item) => (
              <VoiceItem key={item.id} item={item} open={openId === item.id} onToggle={() => setOpenId((value) => (value === item.id ? null : item.id))} onChange={(changes) => updateItem(item.id, changes)} />
            ))}
          </ul>
        </section>

        <button type="button" disabled={phase !== "review"} onClick={() => setPhase("approved")} className="hf-btn-primary mt-5 w-full py-3.5 text-[15px] disabled:opacity-45">{approved ? "Godkendt" : "Godkend"}</button>
      </div>
    </HfScreen>
  );
}
