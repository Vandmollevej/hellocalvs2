"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { productDatabaseHref, type ProductDatabaseFilters } from "@/lib/admin-product-database-query";

// Uendelig scroll på admin Varer: når bunden kommer til syne, hentes næste
// portion ved at hæve `page` (serveren viser portion 1..page).
export function InfiniteScrollLoader({ filters }: { filters: ProductDatabaseFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const next = productDatabaseHref(filters, { page: filters.page + 1 });

  useEffect(() => {
    const node = ref.current;
    if (!node || pending) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        startTransition(() => router.replace(next, { scroll: false }));
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [next, pending, router]);

  return (
    <div ref={ref} className="hf-type-body py-4 text-center text-text-muted">
      {pending ? "Henter flere varer…" : "Scroll for flere varer"}
    </div>
  );
}
