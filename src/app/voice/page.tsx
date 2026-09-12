"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconCheck, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SwipeableRow } from "@/components/SwipeableRow";
import { useTranslation } from "@/i18n/LocaleProvider";

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
  /** Whether this item is a saved registration (has a real, server-issued id) or still an unconfirmed preview. */
  saved: boolean;
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
    id: `pending-${Date.now()}-${index}`,
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
    saved: false,
  }));
}

const VOICE_ITEMS_STORAGE_KEY = "hf-voice-added-items";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function loadPersistedItems(): Item[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VOICE_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date: string; items: Item[] };
    if (parsed.date !== todayKey()) {
      window.localStorage.removeItem(VOICE_ITEMS_STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch {
    return [];
  }
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

type T = (key: string, params?: Record<string, string | number>) => string;

function StandMicrophone() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <rect x="22" y="5" width="20" height="31" rx="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M15 27v2a17 17 0 0 0 34 0v-2M32 46v10M22 57h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 14h10M27 21h10M27 28h10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function VoiceItemRow({
  item,
  onFavorite,
  onReportError,
  onDelete,
  t,
}: {
  item: Item;
  onFavorite?: () => void;
  onReportError?: () => void;
  onDelete: () => void;
  t: T;
}) {
  const content = (
    <div className="flex items-center gap-2.5 py-2.5">
      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-hf-tan">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-sm font-semibold text-hf-black">{item.title}</span>
          {item.estimated && (
            <span className="flex-shrink-0 rounded-full bg-hf-tan px-1.5 py-0.5 text-[10px] font-bold uppercase text-hf-black opacity-70">{t("voice.aiEstimate")}</span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-hf-black opacity-60">{item.amountLabel}</span>
      </div>
      <span className="flex-shrink-0 text-xs text-hf-black opacity-60">{item.kcal} kcal</span>
      {item.saved && <IconChevronRight size={18} className="flex-shrink-0 text-hf-black opacity-40" />}
    </div>
  );

  return (
    <SwipeableRow onFavorite={onFavorite} onReportError={onReportError} onDelete={onDelete}>
      {item.saved ? (
        <Link href={`/registration/${item.id}`} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </SwipeableRow>
  );
}

export default function VoicePage() {
  const { t } = useTranslation();
  const router = useRouter();
  // Loaded from localStorage so items added earlier today survive navigating
  // away (e.g. a swipe to report an error) and back; a previous day's items
  // are dropped (see loadPersistedItems).
  const [items, setItems] = useState<Item[]>(() => loadPersistedItems());
  const [phase, setPhase] = useState<VoicePhase>(() => (loadPersistedItems().length > 0 ? "added" : "idle"));
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const isListeningRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  const liveRequestIdRef = useRef(0);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const micButtonRef = useRef<HTMLButtonElement | null>(null);
  const resetButtonRef = useRef<HTMLButtonElement | null>(null);

  const isListening = phase === "listening";
  const isProcessing = phase === "processing";
  const hasAdded = phase === "added";

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Persist only confirmed (saved) items — an in-progress, unconfirmed preview
  // is not something the user asked to keep across a reload.
  useEffect(() => {
    const savedItems = items.filter((item) => item.saved);
    try {
      if (savedItems.length > 0) {
        window.localStorage.setItem(VOICE_ITEMS_STORAGE_KEY, JSON.stringify({ date: todayKey(), items: savedItems }));
      } else {
        window.localStorage.removeItem(VOICE_ITEMS_STORAGE_KEY);
      }
    } catch {
      // localStorage may be unavailable (private mode) — losing persistence across navigation is an acceptable degradation.
    }
  }, [items]);

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
      // The waveform is purely visual decoration — speech recognition runs independently of it.
    }
  }

  // Single source of truth for the mic's lifecycle: exactly one recognition
  // session is started on mount, and it is fully torn down on unmount.
  useEffect(() => {
    startListening();
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopAudioMeter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  }, []);

  // Any interaction elsewhere on the page stops the mic immediately — it must
  // never keep listening once the user's attention has moved on. The mic
  // toggle and the "start over" button are excluded since they already manage
  // the recognition session themselves.
  useEffect(() => {
    function handleOutsideInteraction(event: PointerEvent) {
      if (!isListeningRef.current) return;
      const target = event.target as Node | null;
      if (micButtonRef.current?.contains(target)) return;
      if (resetButtonRef.current?.contains(target)) return;
      stopListening();
    }
    document.addEventListener("pointerdown", handleOutsideInteraction, true);
    return () => document.removeEventListener("pointerdown", handleOutsideInteraction, true);
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
      setItems((current) => [...current.filter((item) => item.saved), ...mapInterpretedItems(data.items as InterpretedItem[])]);
    } catch {
      // Ignore errors in the ongoing, preliminary interpretation — the final call happens on stop.
    }
  }

  async function finishProcessing() {
    setPhase("processing");
    stopAudioMeter();
    const spokenText = finalTranscriptRef.current.trim();

    if (!spokenText) {
      const remaining = itemsRef.current.filter((item) => item.saved);
      setItems(remaining);
      setPhase(remaining.length > 0 ? "added" : "error");
      if (remaining.length === 0) setErrorMessage(t("voice.error.noSpeech"));
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
      const alreadySaved = itemsRef.current.filter((item) => item.saved);

      if (interpreted.length === 0) {
        setItems(alreadySaved);
        setPhase(alreadySaved.length > 0 ? "added" : "error");
        if (alreadySaved.length === 0) setErrorMessage(t("voice.error.noFoodRecognized"));
        return;
      }

      setItems([...alreadySaved, ...interpreted]);
      setPhase("idle");
      setErrorMessage(null);
    } catch {
      setItems(itemsRef.current.filter((item) => item.saved));
      setPhase("error");
      setErrorMessage(t("voice.error.aiInterpretFailed"));
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
          ? t("voice.error.micDenied")
          : event.error === "no-speech"
            ? t("voice.error.noSpeechCloser")
            : t("voice.error.recognitionInterrupted")
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
      setErrorMessage(t("voice.error.micCouldNotStart"));
    }
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    setPhase("processing");
    recognitionRef.current.stop();
  }

  // Reset means starting completely over: abort the current recognition
  // session outright (not just clear the displayed text) before starting a
  // brand-new one, so no lingering session can silently keep appending its
  // own results back into the transcript afterward.
  function restartListening() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    stopAudioMeter();
    startListening();
  }

  async function addShownItems() {
    const pending = items.filter((item) => !item.saved);
    if (pending.length === 0) return;
    setIsAdding(true);
    setErrorMessage(null);

    const pendingIds = new Set(pending.map((item) => item.id));
    const results = await Promise.all(
      pending.map(async (item) => {
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
          return { ...item, id: saveData.registration.id as string, saved: true };
        } catch {
          return null;
        }
      })
    );

    const newlySaved = results.filter((result): result is Item => result !== null);
    setItems((current) => [...current.filter((item) => !pendingIds.has(item.id)), ...newlySaved]);
    setIsAdding(false);

    if (newlySaved.length === 0) {
      setPhase("error");
      setErrorMessage(t("voice.error.couldNotSaveRegistrations"));
    } else {
      setPhase("added");
      if (newlySaved.length < pending.length) setErrorMessage(t("voice.error.couldNotSaveRegistrations"));
    }
  }

  function deleteItem(item: Item) {
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    if (item.saved) {
      fetch(`/api/registrations/${item.id}`, { method: "DELETE" }).catch(() => {});
    }
  }

  async function favoriteItem(productId: string) {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
    } catch {
      // Silent — matches DailyList's favoriteEntry, not critical enough for an error banner here.
    }
  }

  const hasPendingItems = items.some((item) => !item.saved);

  return (
    <HfScreen title={isListening ? t("voice.listeningTitle") : ""}>
      <div className="flex flex-col px-4 pb-6 pt-5">
        <section className="flex flex-col items-center" aria-live="polite">
          <button
            ref={micButtonRef}
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing || phase === "unsupported"}
            aria-label={isListening ? t("voice.stopMic") : t("voice.startMic")}
            className="relative flex h-24 w-24 items-center justify-center disabled:cursor-default"
          >
            {(isListening || isProcessing) && <span className="absolute inset-0 animate-ping rounded-full bg-hf-green opacity-20 motion-reduce:animate-none" />}
            <span className={`relative flex h-20 w-20 items-center justify-center rounded-full text-hf-white shadow-sm ${phase === "unsupported" ? "bg-hf-gray" : "bg-hf-green"}`}>
              {hasAdded ? <IconCheck size={44} stroke={2.5} /> : <StandMicrophone />}
            </span>
          </button>
          <p className="mt-2 text-xs font-bold text-hf-green">
            {isListening
              ? t("voice.listeningStatus")
              : isProcessing
                ? t("voice.adding")
                : hasAdded
                  ? t("voice.added")
                  : phase === "unsupported"
                    ? t("voice.unsupported")
                    : t("voice.tapToTalk")}
          </p>
          {isListening && <Waveform barRefs={barRefs} />}
          {errorMessage && <p className="mt-2 max-w-[310px] text-center text-xs leading-4 text-red-700">{errorMessage}</p>}
        </section>

        <section className="relative mt-4">
          <button
            ref={resetButtonRef}
            type="button"
            onClick={restartListening}
            aria-label={t("voice.resetTranscript")}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-hf-black text-hf-white"
          >
            <IconRefresh size={16} />
          </button>
          {isListening ? (
            <div className="mt-2 min-h-[72px] w-full rounded-2xl border border-hf-tan-dark bg-hf-white px-4 py-3 text-sm leading-5 text-hf-black">
              <span>{transcript || t("voice.sayNothingYet")}</span>
              <TypingDots />
            </div>
          ) : (
            <textarea
              id="voice-transcript"
              aria-label={t("voice.yourSpeech")}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              placeholder={t("voice.speechPlaceholder")}
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-hf-tan-dark bg-hf-white px-4 py-3 text-sm leading-5 text-hf-black outline-none focus:border-hf-green"
            />
          )}
        </section>

        <section className="mt-5">
          <h2 className="hf-heading mb-1 text-base text-hf-black">{t("voice.added")}</h2>
          <ul className="max-h-[45vh] overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="border-b border-hf-tan-dark last:border-b-0">
                <VoiceItemRow
                  item={item}
                  onFavorite={item.productId ? () => void favoriteItem(item.productId as string) : undefined}
                  onReportError={item.saved ? () => router.push(`/registration/${item.id}/report-error`) : undefined}
                  onDelete={() => deleteItem(item)}
                  t={t}
                />
              </li>
            ))}
          </ul>
          {hasPendingItems && (
            <button
              type="button"
              onClick={() => void addShownItems()}
              disabled={isAdding}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-hf-green text-base font-bold text-hf-white disabled:opacity-60"
            >
              {isAdding ? t("voice.adding") : t("voice.addShownItems")}
            </button>
          )}
        </section>
      </div>
    </HfScreen>
  );
}
