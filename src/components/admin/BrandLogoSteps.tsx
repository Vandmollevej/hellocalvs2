import type { LogoStep, LogoStepStatus } from "@/lib/brand-logo-upload-types";

// Procestrin for en logofil — bruges både i live-visningen under upload og i
// oversigten bagefter (docs/DECISIONS.md 2026-10-04).

const STATUS_MARK: Record<LogoStepStatus, string> = { ok: "✓", skipped: "–", warn: "!", error: "✕" };
const STATUS_TEXT: Record<LogoStepStatus, string> = {
  ok: "text-hf-green-dark",
  skipped: "text-text-muted",
  warn: "text-hf-warning",
  error: "text-hf-red-dark",
};

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-hf-tan-dark border-t-hf-green-dark align-[-1px]"
    />
  );
}

// Kompakt række af trin; trinnet, der kører lige nu, vises med en spinner.
export function StepChips({ steps, running }: { steps: LogoStep[]; running?: string | null }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {steps.map((step) => (
        <li
          key={step.key + step.label}
          title={step.detail}
          className={`hf-type-micro inline-flex items-center gap-1 rounded-full border border-hf-tan-dark bg-hf-white px-2 py-0.5 ${STATUS_TEXT[step.status]}`}
        >
          <span aria-hidden="true">{STATUS_MARK[step.status]}</span>
          {step.label}
        </li>
      ))}
      {running && (
        <li className="hf-type-micro inline-flex items-center gap-1 rounded-full border border-hf-green-dark bg-hf-white px-2 py-0.5 text-hf-green-dark">
          <Spinner />
          {running}
        </li>
      )}
    </ul>
  );
}

// Fuld liste med forklaring og tid pr. trin.
export function StepList({ steps, running }: { steps: LogoStep[]; running?: string | null }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, index) => (
        <li key={step.key + step.label} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={`hf-type-small hf-type-strong flex h-5 w-5 flex-none items-center justify-center rounded-full border border-hf-tan-dark bg-hf-white ${STATUS_TEXT[step.status]}`}
          >
            {STATUS_MARK[step.status]}
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="hf-type-body text-hf-black">
              <span className="text-text-muted">{index + 1}. </span>
              {step.label}
              {step.ms != null && <span className="hf-type-small text-text-muted"> · {step.ms} ms</span>}
            </p>
            {step.detail && <p className={`hf-type-small break-words ${step.status === "skipped" ? "text-text-muted" : STATUS_TEXT[step.status]}`}>{step.detail}</p>}
          </div>
        </li>
      ))}
      {running && (
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 flex-none items-center justify-center">
            <Spinner />
          </span>
          <p className="hf-type-body text-hf-green-dark">{running}…</p>
        </li>
      )}
    </ol>
  );
}
