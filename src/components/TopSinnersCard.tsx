"use client";

// "Største syndere" (G3, docs/DECISIONS.md 2026-09-24): bred boks på
// Statistik-siden med top 5 varer for Kalorier, Fedt og Sukker i den valgte
// periode. Samme vare må gå igen. Klik på et billede åbner varen.

import Link from "next/link";
import { IconToolsKitchen2 } from "@tabler/icons-react";
import {
  aggregateSources,
  formatMetric,
  SOURCE_METRICS,
  type SourceItem,
  type SourceMetric,
  type SourceRegistration,
} from "@/lib/food-classification";

const TOP_COUNT = 5;

function SinnerTile({ item, metric }: { item: SourceItem; metric: SourceMetric }) {
  const content = (
    <>
      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-hf-cream">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-contain object-center" />
        ) : (
          <IconToolsKitchen2 size={20} aria-label={item.title} />
        )}
      </span>
      <span className="hf-type-micro text-center text-hf-black">{formatMetric(item.value, metric)}</span>
    </>
  );
  const className = "flex min-w-0 flex-col items-center gap-1";
  return item.productId ? (
    <Link href={`/add/${item.productId}`} className={className} title={item.title}>
      {content}
    </Link>
  ) : (
    <div className={className} title={item.title}>
      {content}
    </div>
  );
}

export function TopSinnersCard({
  registrations,
  loading,
}: {
  registrations: SourceRegistration[];
  loading?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
      <h2 className="hf-type-body hf-heading text-hf-black">Største syndere</h2>

      {SOURCE_METRICS.map((metric) => {
        const items = loading ? [] : aggregateSources(registrations, metric.key).slice(0, TOP_COUNT);
        return (
          <div key={metric.key} className="flex flex-col gap-2">
            <p className="hf-type-small hf-type-strong text-hf-black">{metric.label}</p>
            {items.length === 0 ? (
              <p className="hf-type-small text-text-secondary">{loading ? "—" : "Ingen registreringer i perioden"}</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {items.map((item) => (
                  <SinnerTile key={item.key} item={item} metric={metric.key} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
