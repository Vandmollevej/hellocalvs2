"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiUsageOverview, ServiceOverview } from "@/lib/api-usage";
import { STATE_BAR, STATE_CHIP, STATE_LABEL, formatMoney, formatPrice } from "@/lib/api-usage-format";

// Admin → API-forbrug: ét kort pr. betalt tjeneste med status, månedens
// forbrug og budget. Henter igen hvert minut, mens siden står åben.
const REFRESH_MS = 60_000;
const timeFmt = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

function BudgetBar({ service }: { service: ServiceOverview }) {
  if (service.budgetUse === null) return null;
  const pct = Math.min(100, Math.round(service.budgetUse * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-hf-tan">
      <div className={`h-full rounded-full ${STATE_BAR[service.state]}`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

function ServiceTile({ service, onSaved }: { service: ServiceOverview; onSaved: (data: ApiUsageOverview) => void }) {
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(service.budget?.toString() ?? "");
  const [price, setPrice] = useState(service.unitPrice?.toString() ?? "");
  const [alertAt, setAlertAt] = useState(service.alertAt?.toString() ?? "");
  const [balanceAlertAt, setBalanceAlertAt] = useState(service.balanceAlertAt?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-usage/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, monthlyBudget: budget, unitPrice: price, alertAt, balanceAlertAt }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiUsageOverview & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      onSaved(data);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  const live = service.defaultUnitPrice === null;
  return (
    <section className="hf-panel" id={`usage-${service.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hf-tan-dark bg-hf-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api-logos/${service.logo}.png`} alt="" className="h-5 w-5 object-contain" />
          </span>
          <h2 className="hf-type-strong truncate text-hf-black">{service.name}</h2>
        </div>
        <span className={`hf-type-small shrink-0 rounded-full px-2 py-0.5 ${STATE_CHIP[service.state]}`}>
          {STATE_LABEL[service.state]}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="hf-type-title text-hf-black">{formatMoney(service.spent, service.currency)}</p>
        <p className="hf-type-small text-text-muted">
          {service.budget ? `af ${formatMoney(service.budget, service.currency)}` : "intet budget"}
        </p>
      </div>
      <BudgetBar service={service} />
      {(service.alertAt !== null || service.balanceAlertAt !== null) && (
        <p className={`hf-type-small ${service.alertReached ? "text-hf-warning" : "text-text-muted"}`}>
          Varsel ved:{" "}
          {[
            service.alertAt !== null ? `forbrug på ${formatMoney(service.alertAt, service.currency)}` : null,
            service.balanceAlertAt !== null ? `saldo under ${formatMoney(service.balanceAlertAt, service.currency)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {service.problem ? (
        <div className="flex flex-col gap-1 rounded-card bg-hf-warning-bg p-2">
          <p className="hf-type-strong text-hf-warning">{service.problem.title}</p>
          <p className="hf-type-small text-hf-warning">{service.problem.action}</p>
          {service.problem.fixUrl && (
            <a href={service.problem.fixUrl} target="_blank" rel="noreferrer" className="hf-type-small text-hf-warning underline">
              Ret det hos udbyderen
            </a>
          )}
        </div>
      ) : (
        <p className="hf-type-small text-text-secondary">{service.stateText}</p>
      )}
      <p className="hf-type-small text-text-muted">
        {service.spentNote ??
          (live
            ? "Forbrug denne måned, hentet live."
            : `${service.calls ?? 0} kald denne måned${service.errors ? ` (${service.errors} fejlede)` : ""} · ${formatPrice(service.unitPrice, service.currency)} pr. kald`)}
      </p>

      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2 border-t border-hf-tan-dark pt-3">
          <label className="flex flex-col gap-1">
            <span className="hf-type-caption">Månedsbudget ({service.currency})</span>
            <input className="hf-input" inputMode="decimal" placeholder="Tomt = intet budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hf-type-caption">Advar mig, når månedens forbrug når ({service.currency})</span>
            <input className="hf-input" inputMode="decimal" placeholder="Tomt = intet beløbsvarsel" value={alertAt} onChange={(e) => setAlertAt(e.target.value)} />
          </label>
          {service.id === "openai" && (
            <label className="flex flex-col gap-1">
              <span className="hf-type-caption">Advar mig, når kreditsaldoen er under ({service.currency})</span>
              <input className="hf-input" inputMode="decimal" placeholder="5" value={balanceAlertAt} onChange={(e) => setBalanceAlertAt(e.target.value)} />
            </label>
          )}
          {!live && (
            <label className="flex flex-col gap-1">
              <span className="hf-type-caption">Pris pr. kald ({service.currency})</span>
              <input className="hf-input" inputMode="decimal" placeholder={String(service.defaultUnitPrice)} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
          )}
          <p className="hf-type-small text-text-muted">{service.priceNote}</p>
          {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="hf-btn-brand hf-btn--inline hf-btn--compact">
              {saving ? "Gemmer …" : "Gem"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="hf-btn-text text-text-secondary">
              Annullér
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing(true)} className="hf-btn-text text-hf-green-dark">
            Ret budget og varsler
          </button>
          <a href={service.billingUrl} target="_blank" rel="noreferrer" className="hf-type-small self-center text-text-muted underline">
            Fakturering hos udbyderen
          </a>
        </div>
      )}
    </section>
  );
}

export function ApiUsageDashboard({ initial }: { initial: ApiUsageOverview }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/api-usage${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as ApiUsageOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const active = data.services.filter((s) => s.state !== "missing");
  const problems = active.filter((s) => s.state === "fail" || s.state === "warn");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hf-type-body text-text-secondary">
          {problems.length === 0
            ? `Alle ${active.length} betalte tjenester kører inden for budget.`
            : `${problems.length} ${problems.length === 1 ? "tjeneste kræver" : "tjenester kræver"} opmærksomhed: ${problems.map((s) => s.name).join(", ")}.`}{" "}
          <span className="text-text-muted">Opdateret {timeFmt.format(new Date(data.checkedAt))}.</span>
        </p>
        <button type="button" onClick={() => void refresh(true)} disabled={loading} className="hf-btn-secondary hf-btn--inline hf-btn--compact">
          {loading ? "Henter …" : "Tjek nu"}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.services.map((service) => (
          <ServiceTile key={`${service.id}:${service.budget}:${service.unitPrice}:${service.alertAt}:${service.balanceAlertAt}`} service={service} onSaved={setData} />
        ))}
      </div>
    </div>
  );
}
