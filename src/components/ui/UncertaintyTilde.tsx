// Det globale grønne usikkerheds-~ (docs/DECISIONS.md 2026-09-24): vises
// foran en værdi, der er estimeret (lånt fra en generisk/lignende vare eller
// AI-udfyldt), fordi producenten ikke selv oplyser den. Bevidst tastatur-
// tegnet "~" (brugerens valg), med størrelse/stregtykkelse fra den godkendte
// mockup (v4, 2026-09-23): ca. 2,4 × tekstens højde og en tynd kontur.
// `small` bruges i den grå forklaringslinje, hvor teksten selv er mindre.
export function UncertaintyTilde({ small = false, className = "" }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`hf-uncertainty-tilde text-hf-green ${small ? "hf-uncertainty-tilde--small" : ""} ${className}`}
    >
      ~
    </span>
  );
}
