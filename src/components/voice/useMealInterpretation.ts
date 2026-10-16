"use client";

import { useEffect, useRef, useState } from "react";
import { mealShareBody } from "@/lib/meal-share";
import type { MealInputLanguageCode } from "@/lib/meal-input-language";

// Tale-sidens funktion, uændret, på Madvarer (docs/DECISIONS.md 2026-10-16):
// det sagte tolkes af AI'en (/api/ai/interpret-meal) til varer med mængde —
// "to skiver franskbrød med smør og marmelade" giver tre forslag. Tolkningen
// kører løbende, mens man taler (700 ms efter sidste ord), og en sidste gang,
// når mikrofonen stopper. Forslag fra tidligere optagelser bliver stående, til
// de tilføjes eller slettes. Intet gemmes uden Tilføj (docs/AI.md). Dagens
// tilføjede varer huskes, når man går væk og tilbage.

export type VoiceItem = {
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
  /** Gemt registrering (id = registreringens id) eller forslag. */
  saved: boolean;
  /** Hvilken optagelse et forslag kom fra; en optagelse erstatter kun sine egne forslag. */
  batch?: number;
};

type InterpretedItem = Omit<VoiceItem, "id" | "saved" | "batch">;

export type VoiceMealError = "noSpeech" | "noFoodRecognized" | "aiInterpretFailed" | "couldNotSaveRegistrations";

const LIVE_DELAY_MS = 700;
const VOICE_ITEMS_STORAGE_KEY = "hf-voice-added-items";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function loadPersistedItems(): VoiceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VOICE_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { date: string; items: VoiceItem[] };
    if (parsed.date !== todayKey()) {
      window.localStorage.removeItem(VOICE_ITEMS_STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch {
    return [];
  }
}

function mapInterpretedItems(interpreted: InterpretedItem[], batch: number): VoiceItem[] {
  return interpreted.map((item, index) => ({
    ...item,
    id: `pending-${batch}-${Date.now()}-${index}`,
    saved: false,
    batch,
  }));
}

/** Alt, der ikke er forslag fra den givne optagelse: gemte rækker og andre optagelsers forslag. */
function keepOtherItems(items: VoiceItem[], batch: number) {
  return items.filter((item) => item.saved || item.batch !== batch);
}

export function useMealInterpretation({
  text,
  listening,
  spoken,
  language,
  voiceSession,
}: {
  /** Det sagte (søgefeltets tekst). */
  text: string;
  listening: boolean;
  /** Falsk, når teksten er skrevet i hånden — så tolkes intet. */
  spoken: boolean;
  language: () => MealInputLanguageCode;
  /** Mikrofonens session, så tolkningen vises i Analyse → Søgning → Tale. */
  voiceSession?: () => string | null;
}) {
  // Dagens gemte varer huskes, når man går væk og tilbage (som på Tale-siden).
  const [items, setItems] = useState<VoiceItem[]>(() => loadPersistedItems());
  const [error, setError] = useState<VoiceMealError | null>(null);
  const [adding, setAdding] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const itemsRef = useRef<VoiceItem[]>([]);
  const batchRef = useRef(0);
  const requestIdRef = useRef(0);
  const languageRef = useRef(language);
  const voiceSessionRef = useRef(voiceSession);
  const wasListeningRef = useRef(false);

  useEffect(() => {
    languageRef.current = language;
    voiceSessionRef.current = voiceSession;
  }, [language, voiceSession]);

  useEffect(() => {
    itemsRef.current = items;
    const savedItems = items.filter((item) => item.saved);
    try {
      if (savedItems.length > 0) {
        window.localStorage.setItem(VOICE_ITEMS_STORAGE_KEY, JSON.stringify({ date: todayKey(), items: savedItems }));
      } else {
        window.localStorage.removeItem(VOICE_ITEMS_STORAGE_KEY);
      }
    } catch {
      // Uden localStorage (privat tilstand) huskes listen bare ikke.
    }
  }, [items]);

  useEffect(() => {
    const stopped = wasListeningRef.current && !listening;
    wasListeningRef.current = listening;
    if (!spoken) return;
    if (!listening && !stopped) return;
    const transcript = text.trim();
    const batch = batchRef.current;

    if (stopped && !transcript) {
      const remaining = keepOtherItems(itemsRef.current, batch);
      setItems(remaining);
      if (remaining.length === 0) setError("noSpeech");
      return;
    }
    if (!transcript) return;

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(
      async () => {
        setInterpreting(true);
        try {
          const response = await fetch("/api/ai/interpret-meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript,
              language: languageRef.current(),
              voiceSession: voiceSessionRef.current?.() ?? undefined,
            }),
          });
          const data = (await response.json()) as { items?: InterpretedItem[]; message?: string };
          if (!response.ok) throw new Error(data.message ?? "AI-tolkning slog fejl");
          if (requestId !== requestIdRef.current) return;
          const interpreted = mapInterpretedItems(data.items ?? [], batch);
          const others = keepOtherItems(itemsRef.current, batch);
          if (stopped && interpreted.length === 0) {
            setItems(others);
            if (others.length === 0) setError("noFoodRecognized");
            return;
          }
          setItems([...others, ...interpreted]);
          if (stopped) setError(null);
        } catch {
          // Den løbende tolkning er foreløbig; kun den sidste melder fejl.
          if (requestId !== requestIdRef.current || !stopped) return;
          setItems(keepOtherItems(itemsRef.current, batch));
          setError("aiInterpretFailed");
        } finally {
          if (requestId === requestIdRef.current) setInterpreting(false);
        }
      },
      stopped ? 0 : LIVE_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [text, listening, spoken]);

  /** En ny optagelse = et nyt hold forslag; tidligere forslag bliver stående. */
  function newRecording() {
    batchRef.current += 1;
    requestIdRef.current += 1;
    setInterpreting(false);
    setError(null);
  }

  async function add(pending: VoiceItem[]) {
    if (pending.length === 0) return;
    setAdding(true);
    setError(null);
    const pendingIds = new Set(pending.map((item) => item.id));
    const results = await Promise.all(
      pending.map(async (item) => {
        try {
          const response = await fetch("/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(item.productId
                ? { productId: item.productId, amountGrams: item.amountGrams }
                : {
                    amountGrams: item.amountGrams,
                    titleSnapshot: item.title,
                    kcalSnapshot: item.kcal,
                    proteinSnapshot: item.protein,
                    carbsSnapshot: item.carbs,
                    fatSnapshot: item.fat,
                  }),
              // Fælles måltid (docs/FAMILY.md).
              ...mealShareBody(),
            }),
          });
          if (!response.ok) return null;
          const data = (await response.json()) as { registration: { id: string } };
          return { ...item, id: data.registration.id, saved: true };
        } catch {
          return null;
        }
      })
    );
    const newlySaved = results.filter((result): result is VoiceItem => result !== null);
    setItems((current) => [...current.filter((item) => !pendingIds.has(item.id)), ...newlySaved]);
    setAdding(false);
    if (newlySaved.length < pending.length) setError("couldNotSaveRegistrations");
  }

  /** Et forslag fjernes bare; en gemt registrering slettes (efter bekræftelse i UI'et). */
  function remove(item: VoiceItem) {
    setItems((current) => current.filter((existing) => existing.id !== item.id));
    if (item.saved) fetch(`/api/registrations/${item.id}`, { method: "DELETE" }).catch(() => {});
  }

  return { items, error, adding, interpreting, add, remove, newRecording };
}
