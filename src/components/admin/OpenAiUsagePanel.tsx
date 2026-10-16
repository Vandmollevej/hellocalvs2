"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpenAiUsage } from "@/lib/openai-usage";

// Admin → OpenAI: henter status og forbrug igen hvert minut, så tallene
// følger med, mens siden står åben.
const REFRESH_MS = 60_000;
const usdFmt = new Intl.NumberFormat("da-DK", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" });
const timeFmt = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Copenhagen" });
const usd = (n: number) => usdFmt.format(n);

const STATUS_STYLE: Record<OpenAiUsage["status"]["state"], { label: string; className: string }> = {
  ok: { label: "Kører", className: "bg-hf-green-light text-hf-green-dark" },
  quota: { label: "Kredit brugt op", className: "bg-hf-red-dark text-hf-white" },
  "rate-limited": { label: "Begrænset", className: "bg-hf-warning-bg text-hf-warning-text" },
  invalid: { label: "Nøgle afvist", className: "bg-hf-red-dark text-hf-white" },
  missing: { label: "Ingen nøgle", className: "bg-hf-warning-bg text-hf-warning-text" },
  error: { label: "Ukendt", className: "bg-hf-warning-bg text-hf-warning-text" },
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="hf-type-caption">{label}</p>
      <p className="hf-type-strong text-hf-black">{value}</p>
      {hint && <p className="hf-type-small text-text-muted">{hint}</p>}
    </div>
  );
}

export function OpenAiUsagePanel({ initial }: { initial: OpenAiUsage }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/openai-usage${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Kunne ikke hente (${res.status})`);
      setData((await res.json()) as OpenAiUsage);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function saveBalance(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/openai-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usd: balanceInput }),
      });
      const body = (await res.json().catch(() => ({}))) as OpenAiUsage & { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Saldoen blev ikke gemt");
      setData(body);
      setBalanceInput("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saldoen blev ikke gemt");
    } finally {
      setSaving(false);
    }
  }

  const style = STATUS_STYLE[data.status.state];
  const costs = data.costs;
  const balance = data.balance;
  const maxDay = costs.available ? Math.max(0.01, ...costs.days.map((d) => d.usd)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <section className="hf-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="hf-type-strong text-hf-black">Status</h2>
            <span className={`hf-type-small rounded-full px-2 py-0.5 ${style.className}`}>{style.label}</span>
          </div>
          <button type="button" onClick={() => void refresh(true)} disabled={loading} className="hf-btn-secondary hf-btn--inline">
            {loading ? "Henter …" : "Tjek nu"}
          </button>
        </div>
        <p className="hf-type-body text-text-secondary">{data.status.message}</p>
        <p className="hf-type-small text-text-muted">
          Senest tjekket {timeFmt.format(new Date(data.checkedAt))} · opdateres automatisk hvert minut
        </p>
        {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="hf-panel">
          <h2 className="hf-type-strong text-hf-black">Kredit tilbage</h2>
          {balance.configured ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Resterende (anslået)"
                value={balance.remainingUsd === null ? "–" : usd(balance.remainingUsd)}
                hint={balance.low ? "Lav saldo — fyld op hos OpenAI" : undefined}
              />
              <Stat
                label="Saldo ved indtastning"
                value={usd(balance.enteredUsd)}
                hint={`${dateFmt.format(new Date(balance.enteredAt))}${balance.spentSinceUsd === null ? "" : ` · brugt siden: ${usd(balance.spentSinceUsd)}`}`}
              />
            </div>
          ) : (
            <p className="hf-type-small text-text-muted">Ingen saldo indtastet endnu.</p>
          )}
          <form onSubmit={saveBalance} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="hf-type-caption">Saldo fra OpenAI → Billing (dollar)</span>
              <input
                className="hf-input w-40"
                inputMode="decimal"
                placeholder="fx 25,00"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
              />
            </label>
            <button type="submit" disabled={saving || !balanceInput.trim()} className="hf-btn-brand hf-btn--inline">
              {saving ? "Gemmer …" : "Gem saldo"}
            </button>
          </form>
          <p className="hf-type-small text-text-muted">
            OpenAI har intet API til saldoen. Skriv den ind, når du har fyldt op; forbruget fra næste døgn trækkes fra.{" "}
            <a className="underline" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">
              Åbn Billing
            </a>
          </p>
        </section>

        <section className="hf-panel">
          <h2 className="hf-type-strong text-hf-black">Forbrug</h2>
          {costs.available ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="I dag (UTC)" value={usd(costs.todayUsd)} />
                <Stat label="Sidste 7 dage" value={usd(costs.last7Usd)} />
                <Stat label="Denne måned" value={usd(costs.monthUsd)} />
              </div>
              {costs.lines.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-hf-tan-dark pt-3">
                  <p className="hf-type-caption">Denne måned fordelt</p>
                  {costs.lines.slice(0, 8).map((line) => (
                    <div key={line.name} className="hf-type-small flex justify-between gap-2">
                      <span className="text-text-secondary">{line.name}</span>
                      <span className="text-hf-black">{usd(line.usd)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="hf-type-small text-text-muted">{costs.message}</p>
          )}
          <p className="hf-type-small text-text-muted">OpenAI opdaterer forbruget med nogle minutters forsinkelse.</p>
        </section>
      </div>

      {costs.available && costs.days.length > 0 && (
        <section className="hf-panel">
          <h2 className="hf-type-strong text-hf-black">Sidste 30 dage</h2>
          <div className="flex flex-col gap-1">
            {costs.days
              .slice()
              .reverse()
              .map((d) => (
                <div key={d.date} className="hf-type-small flex items-center gap-2">
                  <span className="w-24 shrink-0 text-text-secondary">{dateFmt.format(new Date(`${d.date}T12:00:00Z`))}</span>
                  <span className="h-2 min-w-[2px] rounded-full bg-hf-green" style={{ width: `${(d.usd / maxDay) * 70}%` }} />
                  <span className="text-text-muted">{usd(d.usd)}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="hf-panel">
        <h2 className="hf-type-strong text-hf-black">Når kreditten slipper op</h2>
        <p className="hf-type-small text-text-secondary">
          Alle OpenAI-kald fejler med “insufficient_quota”: aflæsning af nye varer, måltid fra stemme og foto, chatbotten,
          oversættelser og de natlige AI-robotter. Appen virker ellers — søgning, registrering og lokal OCR kører videre.
          Slå “Auto recharge” til under Billing, så kreditten fyldes op automatisk.
        </p>
      </section>
    </div>
  );
}
