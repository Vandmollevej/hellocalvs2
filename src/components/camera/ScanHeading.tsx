// Trin-overskriften øverst i kamerabilledet (docs/DECISIONS.md 2026-10-02,
// større og nummereret 2026-10-14): "1. Scan stregkode" stort. Det klarede
// trin vises kun kort i StepDoneOverlay — overskriften står alene bagefter
// (brugerens krav 2026-10-15).
export function ScanHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="hf-scan-heading" aria-live="polite">
      <p key={number} className="hf-scan-heading__title">
        {number}. {title}
      </p>
    </div>
  );
}
