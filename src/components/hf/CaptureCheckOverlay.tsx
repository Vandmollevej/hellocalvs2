import { IconCheck } from "@tabler/icons-react";

// Flueben på en foto-boks, når billedet er taget (docs/DECISIONS.md
// 2026-09-26; brugerens krav 2026-10-14: uden baggrund og meget større;
// 2026-10-15: i den mørke signaturgrønne (--hf-color-brand), da den
// lysegrønne ikke kunne ses på de lyse trin-knapper). Bruges
// både i kamera-flowets trin-række og i opret-sidens 2×2-grid.
export function CaptureCheckOverlay({ label, size = 48 }: { label: string; size?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="img" aria-label={label}>
      <IconCheck size={size} stroke={3.5} className="text-hf-brand" />
    </div>
  );
}
