"use client";

import { useEffect, useState } from "react";
import type { ExtraAllergenWord } from "@/lib/allergen-highlight";

// Henter allergen-robottens godkendte ord én gang pr. sideindlæsning
// (GET /api/allergens/words). Fejler hentningen, bruges kun de faste stammer.
let request: Promise<ExtraAllergenWord[]> | null = null;
let loaded: ExtraAllergenWord[] = [];

function loadAllergenWords(): Promise<ExtraAllergenWord[]> {
  request ??= fetch("/api/allergens/words")
    .then((response) => (response.ok ? response.json() : { words: [] }))
    .then((data: { words?: ExtraAllergenWord[] }) => {
      loaded = Array.isArray(data.words) ? data.words : [];
      return loaded;
    })
    .catch(() => {
      request = null;
      return [];
    });
  return request;
}

export function useAllergenWords(): ExtraAllergenWord[] {
  const [words, setWords] = useState<ExtraAllergenWord[]>(loaded);
  useEffect(() => {
    let alive = true;
    void loadAllergenWords().then((list) => {
      if (alive) setWords(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  return words;
}
