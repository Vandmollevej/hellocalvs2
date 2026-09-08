"use client";

import { useEffect, useState } from "react";

// Fejlretninger/FEJLLISTE.md #32: "liggende format" for header-/bundnav-
// kompakt-tilstand betyder specifikt en telefon drejet om (bred, men også
// LAV) — ikke enhver bred skærm (et almindeligt desktop-vindue matcher også
// `orientation: landscape` alene). max-height fanger en rigtig rotereret
// telefon uden at ramme desktop-browservinduer.
const QUERY = "(orientation: landscape) and (max-height: 500px)";

export function useIsCompactLandscape() {
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isCompact;
}
