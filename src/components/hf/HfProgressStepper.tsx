// Fælles HelloFresh-trinindikator (design.md: "Progressområde er en fælles
// komponent"): prik pr. trin, linje mellem prikkerne, label under hver prik.
// Linjen efter det aktive trin fyldes med `progress` (0–1); tidligere linjer
// er helt fyldte. Første label venstrestillet, sidste højrestillet, resten
// centreret under prikken — som i referenceflowet (Oprettelsesflow.png).
// Valgfrit: `activeLabelOnly` viser kun teksten under det aktive trin (flows
// med mange trin), og `onSelect` gør prikkerne tryk-bare (`isStepEnabled`
// spærrer trin, der endnu ikke kan nås).
export function HfProgressStepper({
  steps,
  current,
  progress,
  label,
  activeLabelOnly = false,
  onSelect,
  isStepEnabled,
}: {
  steps: string[];
  current: number;
  progress: number;
  label: string;
  activeLabelOnly?: boolean;
  onSelect?: (index: number) => void;
  isStepEnabled?: (index: number) => boolean;
}) {
  const last = steps.length - 1;
  const fraction = Math.min(1, Math.max(0, progress));
  const overall = last > 0 ? Math.min(1, (current + fraction) / last) : 1;

  return (
    <div
      role={onSelect ? "group" : "progressbar"}
      aria-label={label}
      aria-valuemin={onSelect ? undefined : 0}
      aria-valuemax={onSelect ? undefined : 100}
      aria-valuenow={onSelect ? undefined : Math.round(overall * 100)}
      aria-valuetext={onSelect ? undefined : steps[current]}
      className="min-w-0"
    >
      <div aria-hidden={onSelect ? undefined : "true"} className="flex items-center gap-2">
        {steps.map((step, index) => {
          const dot = (
            <span
              className={`size-2 shrink-0 rounded-full ${
                index <= current ? "bg-[var(--hf-color-progress-dark)]" : "bg-[var(--hf-color-inactive)]"
              }`}
            />
          );
          return (
          <div key={step} className={`flex items-center gap-2 ${index < last ? "min-w-0 flex-1" : ""}`}>
            {onSelect ? (
              <button
                type="button"
                aria-label={step}
                aria-current={index === current ? "step" : undefined}
                disabled={isStepEnabled ? !isStepEnabled(index) : false}
                onClick={() => onSelect(index)}
                className="-m-3 flex shrink-0 items-center justify-center p-3 disabled:cursor-default"
              >
                {dot}
              </button>
            ) : (
              dot
            )}
            {index < last && (
              <span className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--hf-color-inactive)]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--hf-color-progress)]"
                  style={{ width: `${index < current ? 100 : index === current ? fraction * 100 : 0}%` }}
                />
              </span>
            )}
          </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="relative mt-4 h-[18px]">
        {steps.map((step, index) => {
          if (activeLabelOnly && index !== current) return null;
          const position =
            index === 0
              ? "left-0"
              : index === last
                ? "right-0"
                : "-translate-x-1/2 text-center";
          return (
            <span
              key={step}
              className={`absolute top-0 whitespace-nowrap ${position} ${
                index === current ? "hf-type-progress-active" : "hf-type-progress-inactive"
              }`}
              style={index > 0 && index < last ? { left: `${(index / last) * 100}%` } : undefined}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
