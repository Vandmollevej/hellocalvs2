import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";

function format(value: number, digits: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: digits }).format(value);
}

// Den grå forklaringslinje under en værdi (docs/DECISIONS.md 2026-09-24):
// producentens egen ± (kun når producenten selv oplyser den, vist 1:1) og/
// eller hvor meget af værdien der er estimeret, efter hinanden på én linje —
// fx "±0,5 mg  ~ 1,1 mg". Renderer intet, når ingen af delene findes.
export function UncertaintyLine({
  estimated,
  tolerance,
  unit,
  digits,
  className = "",
}: {
  estimated: number | null;
  tolerance: number | null;
  unit: string;
  digits: number;
  className?: string;
}) {
  const hasEstimate = estimated !== null && estimated > 0;
  const hasTolerance = tolerance !== null && tolerance > 0;
  if (!hasEstimate && !hasTolerance) return null;
  return (
    <p className={`text-[12px] text-hf-black/60 ${className}`}>
      {hasTolerance && (
        <span>
          ±{format(tolerance, digits)} {unit}
        </span>
      )}
      {hasTolerance && hasEstimate && <span>&nbsp;&nbsp;</span>}
      {hasEstimate && (
        <span>
          <UncertaintyTilde small /> {format(estimated, digits)} {unit}
        </span>
      )}
    </p>
  );
}
