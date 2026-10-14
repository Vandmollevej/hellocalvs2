import { IconCheck } from "@tabler/icons-react";

// Flueben på en foto-boks, når billedet er taget (docs/DECISIONS.md
// 2026-09-26; brugerens krav 2026-10-14: fluebenet i den lysegrønne
// signaturfarve (--hf-color-accent), uden baggrund og meget større). Bruges
// både i kamera-flowets trin-række og i opret-sidens 2×2-grid.
export function CaptureCheckOverlay({ label, size = 48 }: { label: string; size?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="img" aria-label={label}>
      <IconCheck size={size} stroke={3.5} className="text-hf-positive" />
    </div>
  );
}
