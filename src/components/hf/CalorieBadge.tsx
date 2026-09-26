// Hello Cal-specifik primitiv, dokumenteret i design.md §6.11 — cirkel-badge
// der overlapper nederste venstre hjørne af et opskriftsbillede (samme
// overlap-mønster som NumberedBadge, blot forskudt til bund/venstre) og
// viser kcal pr. person/servering, udregnet af kaldestedet.
export function CalorieBadge({ kcal, unit }: { kcal: number; unit: string }) {
  return (
    <span
      className="absolute -bottom-2 -left-2 flex h-14 w-14 flex-col items-center justify-center rounded-full text-center leading-none shadow-[0_1px_4px_rgb(0_0_0/25%)]"
      style={{ background: "var(--hf-color-white)", color: "var(--hf-color-text)" }}
    >
      <span className="hf-type-small hf-type-strong">{kcal}</span>
      <span className="hf-type-micro hf-type-strong" style={{ color: "var(--hf-color-text-secondary)" }}>
        {unit}
      </span>
    </span>
  );
}
