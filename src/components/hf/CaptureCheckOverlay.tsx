import { IconCheck } from "@tabler/icons-react";

// Overlay med flueben på en foto-boks, når billedet er taget og aflæst
// korrekt (docs/DECISIONS.md 2026-09-26). Bruges både i kamera-flowets
// trin-række og i opret-sidens 2×2-grid.
export function CaptureCheckOverlay({ label, size = 36 }: { label: string; size?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35" role="img" aria-label={label}>
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: "var(--hf-color-positive)", color: "var(--hf-color-white)" }}
      >
        <IconCheck size={Math.round(size * 0.6)} stroke={3} />
      </span>
    </div>
  );
}
