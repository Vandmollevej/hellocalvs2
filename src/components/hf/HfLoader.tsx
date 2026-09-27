// Den samme roterende load-cirkel som på forsiden (/welcome, .hf-loader i
// globals.css). Farven følger currentColor — standard er Hello Cal-grøn.
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

// Semitransparent hvidt overlay med load-cirklen, mens et foto arbejder
// (kameraflowet under Tilføj, docs/DECISIONS.md 2026-09-27).
export function PhotoWorkingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/60" role="status" aria-label={label}>
      <HfLoader size={56} />
    </div>
  );
}
