// Hello Cal-specifik primitiv, dokumenteret i design.md §6.11 — nummereret
// cirkel-badge der overlapper det øverste venstre hjørne af en 1:1-boks.
export function NumberedBadge({ number }: { number: number }) {
  return (
    <span
      className="hf-type-button absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm"
      style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
      aria-hidden="true"
    >
      {number}
    </span>
  );
}
