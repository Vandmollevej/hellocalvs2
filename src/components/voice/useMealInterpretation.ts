"use client";

import { useEffect, useRef, useState } from "react";
import { mealShareBody } from "@/lib/meal-share";
import type { MealInputLanguageCode } from "@/lib/meal-input-language";

// Hele sætninger på Madvarer (docs/DECISIONS.md 2026-10-16): det sagte tolkes
// af AI'en (/api/ai/interpret-meal) til varer med mængde — "to skiver
// franskbrød med smør og marmelade" giver tre forslag. Tolkningen kører løbende,
// mens man taler (700 ms efter sidste ord), og en sidste gang, når mikrofonen
// stopper. Intet gemmes, før brugeren trykker Tilføj (docs/AI.md).

export type MealSuggestion = {
  key: string;
  title: string;
  kcal: number;
  amountGrams: number;
  amountLabel: string;
  protein: number;
  carbs: number;
  fat: number;
  image: string | null;
  productId: string | null;
  estimated: boolean;
  /** Registreringens id, når forslaget er tilføjet. */
  registrationId?: string;
};

type InterpretedItem = Omit<MealSuggestion, "key" | "registrationId">;

const LIVE_DELAY_MS = 700;

export function useMealInterpretation({
  text,
  listening,
  spoken,
  language,
}: {
  /** Det sagte (søgefeltets tekst). */
  text: string;
  listening: boolean;
  /** Falsk, når teksten er skrevet i hånden — så tolkes intet. */
  spoken: boolean;
  language: () => MealInputLanguageCode;
}) {
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [interpreting, setInterpreting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const requestIdRef = useRef(0);
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  const wasListeningRef = useRef(false);

  useEffect(() => {
    const stopped = wasListeningRef.current && !listening;
    wasListeningRef.current = listening;
    const transcript = text.trim();
    if (!spoken || transcript.length < 2) return;
    if (!listening && !stopped) return;

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(
      async () => {
        setInterpreting(true);
        try {
          const response = await fetch("/api/ai/interpret-meal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript, language: languageRef.current() }),
          });
          if (!response.ok) throw new Error("interpret failed");
          const data = (await response.json()) as { items: InterpretedItem[] };
          if (requestId !== requestIdRef.current) return;
          setFailed(false);
          // Allerede tilføjede forslag bliver stående; resten erstattes.
          setSuggestions((current) => [
            ...current.filter((item) => item.registrationId),
            ...data.items.map((item, index) => ({ ...item, key: `${requestId}-${index}` })),
          ]);
        } catch {
          if (requestId === requestIdRef.current && stopped) setFailed(true);
        } finally {
          if (requestId === requestIdRef.current) setInterpreting(false);
        }
      },
      stopped ? 0 : LIVE_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [text, listening, spoken]);

  /** Ny optagelse eller håndskrevet søgning: forslag, der ikke er tilføjet, ryddes. */
  function clearPending() {
    requestIdRef.current += 1;
    setInterpreting(false);
    setFailed(false);
    setSuggestions((current) => current.filter((item) => item.registrationId));
  }

  async function add(items: MealSuggestion[]) {
    const pending = items.filter((item) => !item.registrationId);
    if (pending.length === 0) return false;
    setAdding(true);
    const saved = await Promise.all(
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
          return [item.key, data.registration.id] as const;
        } catch {
          return null;
        }
      })
    );
    const ids = new Map(saved.filter((entry): entry is readonly [string, string] => entry !== null));
    setSuggestions((current) =>
      current.map((item) => (ids.has(item.key) ? { ...item, registrationId: ids.get(item.key) } : item))
    );
    setAdding(false);
    return ids.size === pending.length;
  }

  function remove(key: string) {
    setSuggestions((current) => current.filter((item) => item.key !== key));
  }

  return { suggestions, interpreting, failed, adding, add, remove, clearPending };
}
