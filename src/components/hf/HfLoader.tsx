// Roterende load-cirkel (.hf-loader i globals.css). Forsiden (/welcome) bruger
// sin egen .hello-loader. Farven følger currentColor — standard er Hello Cal-grøn.
export function HfLoader({
  size = 36,
  className = "text-hf-green",
  label,
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={`hf-loader shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 50 50"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle className="hf-loader__path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

// Scanningseffekt, mens et foto arbejder (kameraflowet under Tilføj,
// docs/DECISIONS.md 2026-09-28): en bred hvid/lys gradientstribe fejer hen
// over billedet i stedet for en load-cirkel, så varen ser ud til at blive scannet.
// Teksten står synligt nederst (brugeren 2026-10-15: "der står ikke nogen
// steder, at billedet behandles"); `showLabel={false}`, når kalderen selv
// skriver teksten.
export function PhotoWorkingOverlay({ label, showLabel = true }: { label: string; showLabel?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden" role="status" aria-label={label}>
      <div className="hf-scan-sweep" />
      {showLabel && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center" aria-hidden>
          <p className="hf-type-small hf-type-strong flex items-center gap-2 bg-hf-black/60 px-3 py-1.5 text-hf-white rounded-card">
            <HfLoader size={14} className="text-hf-white" />
            {label}
          </p>
        </div>
      )}
    </div>
  );
}
