"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconChevronUp, IconMinus, IconPlus, IconRecycle } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Item = {
  id: string;
  title: string;
  kcal: number;
  amountGrams: number;
  amountLabel: string;
  protein: number;
  carbs: number;
  fat: number;
  image?: string | null;
  productId?: string | null;
  estimated?: boolean;
};

type InterpretedItem = {
  title: string;
  amountGrams: number;
  amountLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  productId: string | null;
  image: string | null;
  estimated: boolean;
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

type VoicePhase = "idle" | "listening" | "processing" | "added" | "error" | "unsupported";

function getSpeechRecognition() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function getAudioContextConstructor() {
  const audioWindow = window as typeof window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function mapInterpretedItems(interpreted: InterpretedItem[]): Item[] {
  return interpreted.map((item, index) => ({
    id: `${index}`,
    title: item.title,
    kcal: item.kcal,
    amountGrams: item.amountGrams,
    amountLabel: item.amountLabel,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    image: item.image,
    productId: item.productId,
    estimated: item.estimated,
  }));
}

function parseAmount(label: string): { value: number; unit: string } {
  const trimmed = label.trim();
  const match = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return { value: 0, unit: trimmed || "stk." };
  const value = parseFloat(match[1].replace(",", "."));
  const rawUnit = match[2].trim();
  const unit = !rawUnit || /^stk\.?$|^stykke(r)?$/i.test(rawUnit) ? "stk." : rawUnit;
  return { value: Number.isNaN(value) ? 0 : value, unit };
}

function formatAmount(value: number, unit: string) {
  const rounded = Math.round(value * 10) / 10;
  const text = rounded % 1 === 0 ? rounded.toFixed(0) : String(rounded);
  return `${text} ${unit}`;
}

function TypingDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-0.5" aria-hidden="true">
      <span className="h-1 w-1 animate-bounce rounded-full bg-hf-black opacity-60" style={{ animationDelay: "0ms" }} />
      <span className="h-1 w-1 animate-bounce rounded-full bg-hf-black opacity-60" style={{ animationDelay: "150ms" }} />
      <span className="h-1 w-1 animate-bounce rounded-full bg-hf-black opacity-60" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

const WAVEFORM_BAR_COUNT = 28;

function Waveform({ barRefs }: { barRefs: React.MutableRefObject<(HTMLDivElement | null)[]> }) {
  return (
    <div className="mt-3 flex h-8 w-full max-w-[280px] items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <div
          key={index}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          className="w-[3px] flex-1 rounded-full bg-hf-green"
          style={{ height: "8%" }}
        />
      ))}
    </div>
  );
}

function SwipeableRow({
  onEdit,
  onDelete,
  children,
}: {
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const ACTIONS_WIDTH = 152;
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; base: number; moved: boolean } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: event.clientX, base: open ? -ACTIONS_WIDTH : 0, moved: false };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    setDragX(Math.min(0, Math.max(-ACTIONS_WIDTH, drag.base + delta)));
  }

  function handlePointerUp() {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    setDragging(false);
    if (!drag) return;
    if (!drag.moved) return;
    setDragX((current) => {
      const shouldOpen = current < -ACTIONS_WIDTH / 2;
      setOpen(shouldOpen);
      return shouldOpen ? -ACTIONS_WIDTH : 0;
    });
  }

  function handleContentClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setDragX(0);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDragX(0);
            onEdit();
          }}
          style={{ width: 76 }}
          className="flex items-center justify-center bg-hf-gray text-[13px] font-semibold text-hf-white"
        >
          Rediger
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ width: 76 }}
          className="flex items-center justify-center bg-red-600 text-[13px] font-semibold text-white"
        >
          Slet
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleContentClickCapture}
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 200ms ease" }}
        className="relative bg-hf-white touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}


function StandMicrophone() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <rect x="22" y="5" width="20" height="31" rx="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M15 27v2a17 17 0 0 0 34 0v-2M32 46v10M22 57h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 14h10M27 21h10M27 28h10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MacroBar({ label, grams, max, onChange }: { label: string; grams: number; max: number; onChange: (value: number) => void }) {
  const pct = Math.min(100, (grams / max) * 100);
  const trackRef = useRef<HTMLDivElement>(null);
  const gramsRef = useRef(grams);
  const holdIntervalRef = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(grams));

  useEffect(() => {
    gramsRef.current = grams;
  }, [grams]);

  useEffect(() => stopHold, []);

  function stopHold() {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;

    if (ratio >= 1) {
      if (holdIntervalRef.current === null) {
        onChange(Math.max(max, gramsRef.current));
        holdIntervalRef.current = window.setInterval(() => {
          onChange(gramsRef.current + 1);
        }, 150);
      }
      return;
    }

    stopHold();
    onChange(Math.max(0, Math.round(ratio * max)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.buttons === 0) return;
    updateFromPointer(event.clientX);
  }

  function openEditor() {
    setEditValue(String(grams));
    setEditing(true);
  }

  function commitEdit() {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (!Number.isNaN(parsed)) onChange(Math.max(0, Math.round(parsed)));
    setEditing(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <button
          type="button"
          onClick={openEditor}
          className="min-w-[36px] rounded px-1 text-right text-base font-bold text-hf-black active:bg-hf-tan-dark"
        >
          {grams} g
        </button>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        className="relative flex h-5 touch-none items-center"
      >
        <div className="relative h-1 w-full rounded bg-hf-tan-dark">
          <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white" style={{ left: `${pct}%`, top: "50%" }} />
      </div>

      {editing &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setEditing(false)}
          >
            <div onClick={(event) => event.stopPropagation()} className="mb-6 w-[280px] rounded-2xl bg-hf-white p-4 shadow-lg">
              <p className="text-xs font-bold text-hf-black">{label}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitEdit();
                  }}
                  className="w-full rounded-xl border border-hf-tan-dark px-3 py-2.5 text-lg outline-none focus:border-hf-green"
                />
                <span className="text-sm text-hf-black opacity-70">g</span>
              </div>
              <button type="button" onClick={commitEdit} className="mt-3 w-full rounded-xl bg-hf-green py-2.5 text-sm font-bold text-hf-white">
                Gem
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function VoiceItem({
  item,
  open,
  onToggle,
  onChange,
  onDelete,
  onReset,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
  onChange: (changes: Partial<Item>) => void;
  onDelete: () => void;
  onReset?: () => void;
}) {
  const { value: amountValue, unit: amountUnit } = parseAmount(item.amountLabel);
  const [prevAmountValue, setPrevAmountValue] = useState(amountValue);
  const [amountDraft, setAmountDraft] = useState(String(amountValue));

  if (amountValue !== prevAmountValue) {
    setPrevAmountValue(amountValue);
    setAmountDraft(String(amountValue));
  }

  function applyAmount(newValue: number) {
    const clamped = Math.max(0, newValue);
    const ratio = amountValue > 0 ? clamped / amountValue : 1;
    onChange({
      amountLabel: formatAmount(clamped, amountUnit),
      amountGrams: Math.max(0, Math.round(item.amountGrams * ratio)),
      kcal: Math.max(0, Math.round(item.kcal * ratio)),
      protein: Math.max(0, Math.round(item.protein * ratio)),
      carbs: Math.max(0, Math.round(item.carbs * ratio)),
      fat: Math.max(0, Math.round(item.fat * ratio)),
    });
  }

  function commitAmountDraft() {
    const parsed = parseFloat(amountDraft.replace(",", "."));
    if (!Number.isNaN(parsed)) applyAmount(parsed);
    else setAmountDraft(String(amountValue));
  }

  return (
    <li className="border-b border-hf-tan-dark last:border-b-0">
      <SwipeableRow onEdit={onToggle} onDelete={onDelete}>
        <div className="flex items-center gap-2.5 py-2.5">
          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-full w-full object-contain" />
            )}
          </div>
          <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-sm font-semibold text-hf-black">{item.title}</span>
              {item.estimated && (
                <span className="flex-shrink-0 rounded-full bg-hf-tan px-1.5 py-0.5 text-[10px] font-bold uppercase text-hf-black opacity-70">AI-estimat</span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-hf-black opacity-60">{item.amountLabel}</span>
          </button>
          <span className="text-xs text-hf-black opacity-60">{item.kcal} kcal</span>
          <button type="button" onClick={onToggle} aria-label={open ? "Luk redigering" : `Rediger ${item.title}`} className="flex h-9 w-9 items-center justify-center rounded-full">
            {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
          </button>
        </div>

        {open && (
          <div className="mb-3 rounded-2xl bg-hf-tan p-4 pb-6">
            <label className="block text-xs font-bold text-hf-black">
              Madvare eller ret
              <input value={item.title} onChange={(event) => onChange({ title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-hf-tan-dark bg-hf-white px-3 py-2.5 text-sm font-normal outline-none focus:border-hf-green" />
            </label>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-hf-black opacity-70">Mængde</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyAmount(amountValue - 1)}
                  disabled={amountValue <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-white disabled:opacity-40"
                  aria-label="Mindre mængde"
                >
                  <IconMinus size={14} />
                </button>
                <input
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.target.value)}
                  onBlur={commitAmountDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                  }}
                  inputMode="decimal"
                  aria-label="Mængde"
                  className="w-11 rounded-lg border border-hf-tan-dark bg-hf-white px-1 py-1.5 text-center text-sm outline-none focus:border-hf-green"
                />
                <span className="text-sm font-semibold text-hf-black">{amountUnit}</span>
                <button
                  type="button"
                  onClick={() => applyAmount(amountValue + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-white"
                  aria-label="Større mængde"
                >
                  <IconPlus size={14} />
                </button>
              </div>
            </div>

            <p className="hf-heading mb-4 mt-5 text-[15px] text-hf-black">Energifordeling</p>
            <div className="flex flex-col gap-4">
              <MacroBar label="Protein" grams={item.protein} max={30} onChange={(value) => onChange({ protein: value })} />
              <MacroBar label="Kulhydrat" grams={item.carbs} max={40} onChange={(value) => onChange({ carbs: value })} />
              <MacroBar label="Fedt" grams={item.fat} max={20} onChange={(value) => onChange({ fat: value })} />
            </div>

            {onReset && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={onReset}
                  aria-label="Nulstil ændringer"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-hf-green text-hf-white"
                >
                  <IconRecycle size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </SwipeableRow>
    </li>
  );
}

export default function StemmePage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const isListeningRef = useRef(false);
  const liveRequestIdRef = useRef(0);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const originalItemsRef = useRef<Record<string, Item>>({});

  const isListening = phase === "listening";
  const isProcessing = phase === "processing";
  const hasAdded = phase === "added";

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  function stopAudioMeter() {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  function drawWaveformFrame() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const t = performance.now() / 1000;
    const bars = barRefs.current;
    for (let i = 0; i < bars.length; i += 1) {
      const bar = bars[i];
      if (!bar) continue;
      const dataIndex = Math.floor((i / bars.length) * data.length);
      const amplitude = data[dataIndex] / 255;
      const idle = 0.05 + 0.03 * Math.sin(t * 3 + i * 0.6);
      const level = Math.min(1, idle + amplitude * 0.9);
      bar.style.height = `${Math.max(6, level * 100)}%`;
    }
    rafIdRef.current = requestAnimationFrame(drawWaveformFrame);
  }

  async function startAudioMeter() {
    try {
      const AudioCtxConstructor = getAudioContextConstructor();
      if (!AudioCtxConstructor) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioCtxConstructor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
      rafIdRef.current = requestAnimationFrame(drawWaveformFrame);
    } catch {
      // Waveform er kun visuel pynt — talegenkendelsen kører uafhængigt af den.
    }
  }

  useEffect(() => {
    startListening();
    return () => {
      recognitionRef.current?.abort();
      stopAudioMeter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kør kun ved mount
  }, []);

  useEffect(() => {
    if (!isListening) return;
    if (!transcript.trim()) return;
    const handle = setTimeout(() => {
      interpretLive(transcript);
    }, 700);
    return () => clearTimeout(handle);
  }, [transcript, isListening]);

  async function interpretLive(text: string) {
    const requestId = ++liveRequestIdRef.current;
    try {
      const res = await fetch("/api/ai/interpret-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (requestId !== liveRequestIdRef.current) return;
      if (!isListeningRef.current) return;
      setItems(mapInterpretedItems(data.items as InterpretedItem[]));
    } catch {
      // Ignorer fejl i den løbende, foreløbige tolkning — det endelige kald sker når man stopper.
    }
  }

  async function finishProcessing() {
    setPhase("processing");
    stopAudioMeter();
    const spokenText = finalTranscriptRef.current.trim();

    if (!spokenText) {
      setPhase(items.length > 0 ? "added" : "error");
      if (items.length === 0) setErrorMessage("Jeg hørte ingen tale. Prøv igen.");
      return;
    }

    try {
      const res = await fetch("/api/ai/interpret-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: spokenText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "AI-tolkning slog fejl");

      const interpreted = mapInterpretedItems(data.items as InterpretedItem[]);
      if (interpreted.length === 0) {
        setPhase("error");
        setErrorMessage("Jeg kunne ikke genkende nogen madvarer. Prøv igen.");
        return;
      }

      const saved = await Promise.all(
        interpreted.map(async (item) => {
          try {
            const saveRes = await fetch("/api/registrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                item.productId
                  ? { productId: item.productId, amountGrams: item.amountGrams }
                  : {
                      amountGrams: item.amountGrams,
                      titleSnapshot: item.title,
                      kcalSnapshot: item.kcal,
                      proteinSnapshot: item.protein,
                      carbsSnapshot: item.carbs,
                      fatSnapshot: item.fat,
                    }
              ),
            });
            if (!saveRes.ok) return null;
            const saveData = await saveRes.json();
            return { ...item, id: saveData.registration.id as string };
          } catch {
            return null;
          }
        })
      );

      const savedItems = saved.filter((item): item is Item => item !== null);
      savedItems.forEach((savedItem) => {
        originalItemsRef.current[savedItem.id] = savedItem;
      });
      setItems((current) => [...current, ...savedItems]);
      setPhase(savedItems.length > 0 ? "added" : "error");
      if (savedItems.length === 0) setErrorMessage("Kunne ikke gemme registreringerne. Prøv igen.");
    } catch {
      setPhase("error");
      setErrorMessage("AI-tolkningen slog fejl. Prøv igen.");
    }
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setPhase("unsupported");
      return;
    }

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
    recognition.onstart = () => {
      setPhase("listening");
      startAudioMeter();
    };
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
      stopAudioMeter();
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

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
    fetch(`/api/registrations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function resetItem(id: string) {
    const original = originalItemsRef.current[id];
    if (!original) return;
    setItems((current) => current.map((item) => (item.id === id ? { ...original } : item)));
  }

  return (
    <HfScreen title={isListening ? "Lytter..." : ""}>
      <div className="flex flex-col px-4 pb-6 pt-5">
        <section className="flex flex-col items-center" aria-live="polite">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || phase === "unsupported"}
            aria-label={isListening ? "Stop mikrofonen" : "Start mikrofonen"}
            className="relative flex h-24 w-24 items-center justify-center disabled:cursor-default"
          >
            {(isListening || isProcessing) && <span className="absolute inset-0 animate-ping rounded-full bg-hf-green opacity-20 motion-reduce:animate-none" />}
            <span className={`relative flex h-20 w-20 items-center justify-center rounded-full text-hf-white shadow-sm ${phase === "unsupported" ? "bg-hf-gray" : "bg-hf-green"}`}>
              {hasAdded ? <IconCheck size={44} stroke={2.5} /> : <StandMicrophone />}
            </span>
          </button>
          <p className="mt-2 text-xs font-bold text-hf-green">
            {isListening
              ? "Lytter — tryk for at stoppe"
              : isProcessing
                ? "Tilføjer..."
                : hasAdded
                  ? "Tilføjet"
                  : phase === "unsupported"
                    ? "Talegenkendelse understøttes ikke"
                    : "Tryk på mikrofonen for at tale"}
          </p>
          {isListening && <Waveform barRefs={barRefs} />}
          {errorMessage && <p className="mt-2 max-w-[310px] text-center text-xs leading-4 text-red-700">{errorMessage}</p>}
        </section>

        <section className="mt-4">
          {isListening ? (
            <div className="mt-2 min-h-[72px] w-full rounded-2xl border border-hf-tan-dark bg-hf-white px-4 py-3 text-sm leading-5 text-hf-black">
              <span>{transcript || "Sig noget..."}</span>
              <TypingDots />
            </div>
          ) : (
            <textarea
              id="voice-transcript"
              aria-label="Din tale"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Din tale vises her..."
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-hf-tan-dark bg-hf-white px-4 py-3 text-sm leading-5 text-hf-black outline-none focus:border-hf-green"
            />
          )}
        </section>

        <section className="mt-5">
          <h2 className="hf-heading mb-1 text-base text-hf-black">Tilføjet</h2>
          <ul className="max-h-[45vh] overflow-y-auto">
            {items.map((item) => (
              <VoiceItem
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId((value) => (value === item.id ? null : item.id))}
                onChange={(changes) => updateItem(item.id, changes)}
                onDelete={() => deleteItem(item.id)}
                onReset={originalItemsRef.current[item.id] ? () => resetItem(item.id) : undefined}
              />
            ))}
          </ul>
        </section>
      </div>
    </HfScreen>
  );
}
