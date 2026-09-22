// Global Hello Cal-separator: "──── TEKST ────" centreret, ubrudte streger på
// begge sider, ca. 80 % af bredden, ingen bjælke eller baggrund. Bruges til
// både TIDSPUNKT (TimeSection) og datogrupper — opret ikke lokale varianter.
export function SectionSeparator({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div role="separator" aria-label={label} className={`mx-auto flex w-[80%] min-w-0 items-center gap-3 ${className}`}>
      <div aria-hidden="true" className="h-px min-w-0 flex-1 bg-hf-tan-dark" />
      <span className="shrink-0 text-[12px] font-medium uppercase tracking-[0.08em] text-hf-gray-dark">{label}</span>
      <div aria-hidden="true" className="h-px min-w-0 flex-1 bg-hf-tan-dark" />
    </div>
  );
}
