"use client";

import { useEffect, useState } from "react";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/ad-inventory";
import type { SpotStats } from "@/lib/partner-performance";

// Data mining: ét kort pr. reklamespot i to kolonner med banner, klik,
// visninger og "ud af" aftalt. "Vis mere" åbner et overlay med en tabel over
// alle sider (links), reklamen er vist på: visninger, klik og sekunder
// eksponeret (docs/DECISIONS.md 2026-10-02).
const num = (v: number) => v.toLocaleString("da-DK");
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

function triggerText(s: SpotStats) {
  return [s.triggerCategory ? PRODUCT_CATEGORY_LABELS[s.triggerCategory] ?? s.triggerCategory : "", s.triggerProductType ?? ""].filter(Boolean).join(" · ");
}

function Stat({ label, value, of }: { label: string; value: number; of: number | null }) {
  return (
    <div className="hf-kpi">
      <p className="hf-type-caption">{label}</p>
      <p className="hf-type-title">
        {num(value)}
        {of !== null && <span className="hf-type-body text-text-secondary"> af {num(of)}</span>}
      </p>
      {of !== null && of > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hf-white">
          <div className="h-full rounded-full bg-hf-green-dark" style={{ width: `${Math.min(100, (value / of) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function PathsOverlay({ spot, onClose }: { spot: SpotStats; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Sider for ${spot.name}`}>
      <div className="absolute inset-0 bg-hf-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85dvh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-t-xl bg-hf-white p-4 shadow-xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="hf-type-title text-hf-black">{spot.name}</h3>
            <p className="hf-type-caption">Alle sider reklamen er vist på</p>
          </div>
          <button onClick={onClose} aria-label="Tilbage" className="hf-btn-icon rounded-md text-text-secondary hover:bg-hf-tan">✕</button>
        </div>
        <div className="overflow-auto">
          <table className="hf-type-body w-full text-left">
            <thead className="sticky top-0 bg-hf-white text-text-secondary">
              <tr>
                <th className="py-1 pr-3">Side (link)</th>
                <th className="py-1 pr-3 text-right">Visning</th>
                <th className="py-1 pr-3 text-right">Kliks</th>
                <th className="py-1 text-right">Sekunder eksponeret</th>
              </tr>
            </thead>
            <tbody>
              {spot.paths.map((p) => (
                <tr key={p.path} className="border-t border-hf-tan-dark">
                  <td className="max-w-[18rem] break-all py-1 pr-3">{p.path}</td>
                  <td className="py-1 pr-3 text-right">{num(p.impressions)}</td>
                  <td className="py-1 pr-3 text-right">{num(p.clicks)}</td>
                  <td className="py-1 text-right">{num(p.seconds)}</td>
                </tr>
              ))}
              {spot.paths.length === 0 && (
                <tr className="border-t border-hf-tan-dark"><td colSpan={4} className="py-2 text-text-muted">Ingen visninger i perioden.</td></tr>
              )}
              {spot.paths.length > 0 && (
                <tr className="hf-type-strong border-t-2 border-hf-tan-dark">
                  <td className="py-1 pr-3">I alt</td>
                  <td className="py-1 pr-3 text-right">{num(spot.impressions)}</td>
                  <td className="py-1 pr-3 text-right">{num(spot.clicks)}</td>
                  <td className="py-1 text-right">{num(spot.seconds)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SpotGrid({ spots }: { spots: SpotStats[] }) {
  const [open, setOpen] = useState<SpotStats | null>(null);
  if (spots.length === 0) return <p className="hf-type-body text-text-secondary">Ingen reklamespots at vise. Opret dem under Sponsoraftale.</p>;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {spots.map((s) => (
          <section key={s.id} className="hf-panel">
            <div>
              <h3 className="hf-type-title text-hf-black">{s.name}</h3>
              <p className="hf-type-caption">
                {s.inventoryName}
                {triggerText(s) && ` · kun ved ${triggerText(s)}`}
              </p>
            </div>
            {s.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- partnerens eget banner
              <img src={s.bannerUrl} alt={`Banner: ${s.name}`} className="w-full rounded-lg border border-hf-tan-dark" />
            ) : (
              <div className="hf-type-small flex h-24 items-center justify-center rounded-lg bg-hf-tan text-text-muted">Intet banner uploadet</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Visninger" value={s.impressions} of={s.agreedImpressions} />
              <Stat label="Kliks" value={s.clicks} of={s.agreedClicks} />
            </div>
            <p className="hf-type-small text-text-secondary">Klikrate {pct(s.ctr)}</p>
            <button className="hf-type-body self-start text-hf-green-dark hover:underline" onClick={() => setOpen(s)}>
              Vis mere
            </button>
          </section>
        ))}
      </div>
      {open && <PathsOverlay spot={open} onClose={() => setOpen(null)} />}
    </>
  );
}
