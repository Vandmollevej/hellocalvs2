"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { SearchCorrection } from "@/lib/search-notice";

const MARK = "\u0001";

// "Viser resultater for X / Søg i stedet efter Y" eller "Mente du X?".
export function SearchCorrectionNotice({
  correction,
  onSearchExact,
  onUseSuggestion,
}: {
  correction: SearchCorrection | null;
  onSearchExact: () => void;
  onUseSuggestion: (suggested: string) => void;
}) {
  const { t } = useTranslation();
  if (!correction) return null;

  // Oversætter med {query} → query fremhævet med fed.
  const withBold = (key: string, query: string): ReactNode => {
    const [before, after = ""] = t(key, { query: MARK }).split(MARK);
    return (
      <>
        {before}
        <strong className="hf-type-strong">{query}</strong>
        {after}
      </>
    );
  };

  if (correction.kind === "suggested") {
    return (
      <button
        type="button"
        className="hf-type-small px-1 text-left text-text-secondary"
        onClick={() => onUseSuggestion(correction.suggested)}
      >
        {withBold("searchCorrection.didYouMean", correction.suggested)}
      </button>
    );
  }

  return (
    <div className="hf-type-small px-1 text-text-secondary">
      <p>{withBold("searchCorrection.showingFor", correction.corrected)}</p>
      <button type="button" className="underline" onClick={onSearchExact}>
        {t("searchCorrection.searchInstead", { query: correction.original })}
      </button>
    </div>
  );
}
