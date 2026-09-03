// Hello Cal-specifik primitiv, dokumenteret i design.md §6.11 — gråtonet
// loading-overlay med en lodret, hvid/gennemsigtig scanningslinje der
// bevæger sig fra venstre mod højre, mens et billede analyseres automatisk
// i /camera/create.
export function ScanningOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black/55">
      <div className="hf-scan-line" />
      <p className="absolute inset-x-4 bottom-4 rounded-full bg-black/50 px-4 py-2 text-center text-xs font-semibold text-white">
        {label}
      </p>
    </div>
  );
}
