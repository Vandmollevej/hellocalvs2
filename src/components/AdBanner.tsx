"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Reklamebanner til en plads i appen (docs/DECISIONS.md 2026-10-02). Henter
// en passende reklame (evt. udløst af kategori/produkttype), registrerer
// visningen med siden den vistes på, måler hvor længe den var synlig og
// registrerer klik. Viser intet, hvis der ikke er en reklame.
type Ad = { id: string; bannerUrl: string; targetUrl: string; name: string };

const track = (body: Record<string, unknown>) =>
  fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true })
    .then((res) => (res.ok ? (res.json() as Promise<{ eventId?: string }>) : null))
    .catch(() => null);

export function AdBanner({ slot, category, productType }: { slot: string; category?: string | null; productType?: string | null }) {
  const pathname = usePathname();
  const [ad, setAd] = useState<Ad | null>(null);
  const ref = useRef<HTMLAnchorElement | HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ slot });
    if (category) query.set("category", category);
    if (productType) query.set("productType", productType);
    fetch(`/api/ads/serve?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ads?: Ad[] } | null) => {
        if (!cancelled) setAd(data?.ads?.[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slot, category, productType]);

  useEffect(() => {
    const node = ref.current;
    if (!ad || !node || typeof IntersectionObserver === "undefined") return;
    let eventId: string | undefined;
    let visibleSince: number | null = null;
    let seconds = 0;
    let counted = false;
    const flush = () => {
      if (visibleSince !== null) {
        seconds += (Date.now() - visibleSince) / 1000;
        visibleSince = null;
      }
      if (eventId && seconds >= 1) {
        void track({ eventId, seconds: Math.round(seconds) });
        seconds = 0;
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          visibleSince = Date.now();
          if (!counted) {
            counted = true;
            void track({ locationId: ad.id, type: "IMPRESSION", path: pathname }).then((res) => {
              eventId = res?.eventId;
            });
          }
        } else flush();
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(node);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [ad, pathname]);

  if (!ad) return null;
  // eslint-disable-next-line @next/next/no-img-element -- partnerens eget banner, ukendt størrelse
  const image = <img src={ad.bannerUrl} alt={ad.name} className="w-full rounded-lg" />;
  return ad.targetUrl ? (
    <a
      ref={ref as React.RefObject<HTMLAnchorElement>}
      href={ad.targetUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => void track({ locationId: ad.id, type: "CLICK", path: pathname })}
      className="block"
    >
      {image}
    </a>
  ) : (
    <div ref={ref as React.RefObject<HTMLDivElement>}>{image}</div>
  );
}
