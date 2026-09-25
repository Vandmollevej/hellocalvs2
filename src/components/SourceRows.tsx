"use client";

// Rækker til "Månedens synder" (G3): samme FoodRow som
// den almindelige madvareliste, men kun den valgte værdi til højre.

import Link from "next/link";
import { IconToolsKitchen2 } from "@tabler/icons-react";
import { FoodRow } from "@/components/FoodRow";
import { formatMetric, type SourceItem, type SourceMetric } from "@/lib/food-classification";

export function SourceItemRow({ item, metric, isLast }: { item: SourceItem; metric: SourceMetric; isLast: boolean }) {
  const row = (
    <FoodRow
      image={item.imageUrl}
      thumbnail={item.imageUrl ? undefined : <IconToolsKitchen2 size={20} />}
      title={item.title}
      right={<span className="text-sm font-semibold text-hf-black">{formatMetric(item.value, metric)}</span>}
    />
  );
  return (
    <div className={`px-4 ${isLast ? "" : "border-b border-hf-tan-dark"}`}>
      {item.productId ? (
        <Link href={`/add/${item.productId}`} className="block">
          {row}
        </Link>
      ) : (
        row
      )}
    </div>
  );
}

export function SourceItemList({ items, metric }: { items: SourceItem[]; metric: SourceMetric }) {
  return (
    <div className="rounded-2xl bg-hf-tan">
      {items.map((item, index) => (
        <SourceItemRow key={item.key} item={item} metric={metric} isLast={index === items.length - 1} />
      ))}
    </div>
  );
}
