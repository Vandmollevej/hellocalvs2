"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { ProductResultRow, type ProductResult } from "@/components/ProductResultRow";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";
import { ItemListSection } from "@/components/hf/ItemList";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { intlLocale } from "@/i18n";
import type { UserScan } from "@/lib/user-scans";
import { dayHeadingLabel, dayKey } from "@/lib/day-heading";

// "Se dine indscanninger" (bruger 2026-10-02): brugerens egne fotograferede
// varer, grupperet under en overskrift med skillelinje pr. dato, de blev taget.
// Rækkerne er de samme som i Søg.

type LoadState = "loading" | "ready" | "error";
type DayGroup = { key: string; date: Date; scans: ProductResult[] };

function groupByDay(scans: UserScan[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const scan of scans) {
    const date = new Date(scan.createdAt);
    const key = dayKey(date);
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) {
      group = { key, date, scans: [] };
      groups.push(group);
    }
    group.scans.push({
      id: scan.id,
      title: scan.name,
      image: scan.imageUrl,
      brand: scan.brand,
      kcal: scan.kcalPer100g,
      macrosEstimated: scan.macrosEstimated,
    });
  }
  return groups;
}

export default function MyScansPage() {
  const { t, locale } = useTranslation();
  const connectionMessage = useConnectionMessage();
  const [scans, setScans] = useState<UserScan[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  // Tryk på en vare åbner varesiden direkte — ingen popup og ingen Tilføj-knap.
  const openProduct = (productId: string) => router.push(`/add/${productId}`);
  const groups = useMemo(() => groupByDay(scans), [scans]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/my-scans", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as { scans: UserScan[] };
      })
      .then((data) => {
        setScans(data.scans);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favorites", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("offline");
        return (await response.json()) as { favorites: Array<{ product: { id: string } | null }> };
      })
      .then((data) =>
        setFavoriteIds(new Set(data.favorites.flatMap((favorite) => (favorite.product ? [favorite.product.id] : []))))
      )
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function toggleFavorite(productId: string, next: boolean) {
    setFavoriteIds((current) => {
      const updated = new Set(current);
      if (next) updated.add(productId);
      else updated.delete(productId);
      return updated;
    });
    fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    }).catch(() => {});
  }

  function dayHeading(date: Date) {
    return dayHeadingLabel(date, intlLocale(locale), { today: t("myScans.today"), yesterday: t("myScans.yesterday") });
  }

  return (
    <HfScreen title={t("myScans.title")}>
      <div className="hf-page web-search-page">
        {state === "loading" && (
          <SkeletonScreen className="overflow-hidden bg-hf-tan px-4 rounded-card">
            <SkeletonMediaRows rows={4} />
          </SkeletonScreen>
        )}
        {state === "error" && (
          <p className="hf-type-body text-text-secondary px-1 text-center">{connectionMessage(t("myScans.loadError"))}</p>
        )}
        {state === "ready" && groups.length === 0 && (
          <p className="hf-type-body text-text-secondary px-1 text-center">{t("myScans.empty")}</p>
        )}
        {groups.map((group) => (
          <ItemListSection key={group.key} heading={dayHeading(group.date)} as="div">
            {group.scans.map((scan) => (
              <ProductResultRow
                key={scan.id}
                {...scan}
                onAdd={openProduct}
                isFavorite={favoriteIds.has(scan.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </ItemListSection>
        ))}
      </div>
    </HfScreen>
  );
}
