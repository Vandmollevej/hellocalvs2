import Link from "next/link";
import type { Kpi } from "@/lib/admin-integration-stats";

// Byggeklodser til admin → Integrationer i samme udtryk som /admin/statistics
// (tan-fliser, kort med kant, sektionsoverskrift i mørkegrøn).

export const num = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

export const dateTime = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string | null) {
  return iso ? dateTime.format(new Date(iso)) : "–";
}

export function pct(part: number, total: number) {
  return total ? `${num.format((part / total) * 100)} %` : "–";
}

// Perioder, der giver mening for integrationer (samme nøgler som Statistik).
const PERIODS = [
  { value: "7d", label: "7 dage" },
  { value: "month", label: "Denne måned" },
  { value: "3m", label: "3 måneder" },
  { value: "6m", label: "6 måneder" },
  { value: "1y", label: "1 år" },
  { value: "all", label: "For evigt" },
] as const;

export function PeriodPicker({ basePath, active }: { basePath: string; active: string }) {
  return (
    <nav aria-label="Periode" className="flex flex-wrap gap-1.5 text-sm">
      {PERIODS.map((period) => {
        const on = period.value === active;
        return (
          <Link
            key={period.value}
            href={`${basePath}?preset=${period.value}`}
            aria-current={on ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${
              on ? "border-hf-green-dark bg-hf-green-dark text-white" : "border-border-strong bg-surface-1 text-text-secondary hover:text-text-primary"
            }`}
          >
            {period.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Delta({ k, invert = false }: { k: Kpi; invert?: boolean }) {
  if (k.previous === 0 && k.current === 0) return <span className="text-text-muted">uændret</span>;
  if (k.previous === 0) return <span className="text-text-muted">ny (forrige: 0)</span>;
  const change = ((k.current - k.previous) / k.previous) * 100;
  const good = invert ? change < 0 : change > 0;
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "■";
  return (
    <span className={change === 0 ? "text-text-muted" : good ? "text-hf-green-dark" : "text-hf-red-dark"}>
      {arrow} {num.format(Math.abs(change))} % <span className="text-text-muted">(forrige: {num.format(k.previous)})</span>
    </span>
  );
}

export function Tile({ label, k, invert }: { label: string; k: Kpi; invert?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-hf-tan p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{num.format(k.current)}</p>
      <p className="text-xs">
        <Delta k={k} invert={invert} />
      </p>
    </div>
  );
}

export function Plain({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-hf-tan p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{typeof value === "number" ? num.format(value) : value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export function Section({ id, title, intro, children }: { id?: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="border-b border-border-strong pb-1 text-base font-semibold text-hf-green-dark">{title}</h2>
      {intro && <p className="text-sm text-text-secondary">{intro}</p>}
      {children}
    </section>
  );
}

export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
      {title && <p className="text-sm font-semibold text-text-primary">{title}</p>}
      {children}
    </div>
  );
}

// Lille statusmærke: forbundet med nøgler, mangler nøgler, kræver app, kræver partneraftale.
export function KindBadge({ kind, configured }: { kind: "oauth" | "companion" | "via" | "unavailable"; configured: boolean | null }) {
  const [text, tone] =
    kind === "unavailable"
      ? ["Kræver partneraftale", "bg-surface-1 text-text-muted"]
      : kind === "via"
        ? ["Via Health Connect / Apple Health", "bg-surface-1 text-text-secondary"]
        : kind === "companion"
        ? ["Via Hello Cal-appen", "bg-surface-1 text-text-secondary"]
        : configured
          ? ["Cloud · nøgler sat", "border border-hf-green-dark text-hf-green-dark"]
          : ["Cloud · mangler nøgler", "bg-hf-warning-bg text-hf-warning"];
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs ${tone}`}>{text}</span>;
}

export function IntegrationIcon({ src, size = 32 }: { src: string | null; size?: number }) {
  if (!src) return <span aria-hidden className="inline-block shrink-0 rounded-[8px] bg-surface-1" style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-[8px] object-contain" style={{ width: size, height: size }} />
  );
}
