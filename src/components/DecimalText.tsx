"use client";

import { useCallback } from "react";
import { decimalSeparatorForRegion, localizeDecimals } from "@/lib/decimal-separator";
import { useRegion } from "@/lib/units";

/** Omskriver varetekster til brugerens decimaltegn ("1.5 l" → "1,5 l" i Danmark). */
export function useLocalizeDecimals(): (text: string) => string {
  const separator = decimalSeparatorForRegion(useRegion());
  return useCallback((text: string) => localizeDecimals(text, separator), [separator]);
}

/** Varetekst (navn, mængde, variant) med brugerens decimaltegn. */
export function DecimalText({ text }: { text: string | null | undefined }) {
  const localize = useLocalizeDecimals();
  return <>{text ? localize(text) : text}</>;
}
