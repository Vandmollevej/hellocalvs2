"use client";

import { useState } from "react";

// Lille kopiér-chip til designmanualen (klassenavne og hex-koder).
export function CopyChip({ value, label, className = "" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Kopiér ${value}`}
      className={`rounded px-1.5 py-0.5 font-mono hover:bg-hf-tan-dark focus-visible:outline-2 focus-visible:outline-hf-black ${className}`}
    >
      <span aria-live="polite">{copied ? "Kopieret" : (label ?? value)}</span>
    </button>
  );
}
