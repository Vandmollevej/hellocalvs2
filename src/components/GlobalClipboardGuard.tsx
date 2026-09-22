"use client";

import { useEffect } from "react";

// Global produktregel (docs/DECISIONS.md, 2026-09-22): copy, cut og paste er
// blokeret i hele appen. Monteres én gang i root-layoutet, så alle nuværende
// og fremtidige felter følger reglen uden lokale onPaste/onCopy/onCut.
const BLOCKED_INPUT_TYPES = new Set([
  "insertFromPaste",
  "insertFromPasteAsQuotation",
  "insertFromDrop",
  "deleteByCut",
]);

export function GlobalClipboardGuard() {
  useEffect(() => {
    const prevent = (event: Event) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isClipboardShortcut =
        ((event.ctrlKey || event.metaKey) && (key === "c" || key === "x" || key === "v")) ||
        (event.shiftKey && event.key === "Insert");
      if (isClipboardShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleBeforeInput = (event: Event) => {
      if (BLOCKED_INPUT_TYPES.has((event as InputEvent).inputType)) {
        event.preventDefault();
      }
    };

    const events: [string, EventListener][] = [
      ["copy", prevent],
      ["cut", prevent],
      ["paste", prevent],
      ["drop", prevent],
      ["keydown", handleKeyDown as EventListener],
      ["beforeinput", handleBeforeInput],
    ];
    events.forEach(([type, listener]) => document.addEventListener(type, listener, true));
    return () => {
      events.forEach(([type, listener]) => document.removeEventListener(type, listener, true));
    };
  }, []);

  return null;
}
