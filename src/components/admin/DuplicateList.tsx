"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { DuplicateCompareGroup } from "@/components/admin/DuplicateCompareGroup";
import { ListModeToggle, LoadMoreSentinel, useListMode } from "@/components/admin/ListMode";
import type { CompareGroup } from "@/lib/duplicate-review";

// Listen på admin "Dubletter" → Varer (docs/DECISIONS.md 2026-10-11).
// Brugeren vælger øverst mellem:
// - Sideinddelt: siden fra serveren (?side=) med Forrige/Næste, som før.
// - Evigheds-scroll: første side fra serveren, derefter hentes næste udsnit
//   gradvist fra /api/admin/duplicate-products/list, mens man scroller.
// Rettede grupper forsvinder, og udsnitsstedet flyttes tilsvarende.
// (Billed-fanen har sin egen størrelses- og sidevælger, DuplicateImageList.)
export function DuplicateList({
  page,
  pages,
  total,
  perPage,
  initialGroups,
  initialConsumed,
}: {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  initialGroups: CompareGroup[];
  initialConsumed: number;
}) {
  const [mode] = useListMode();

  // Evigheds-scroll-tilstand. Startes én gang pr. side (siden remountes med ny
  // key), så server-opdateringer efter en rettelse ikke nulstiller den.
  const [seedGroups] = useState(initialGroups);
  const [extra, setExtra] = useState<CompareGroup[]>([]);
  const [cursor, setCursor] = useState((page - 1) * perPage + initialConsumed);
  const [serverTotal, setServerTotal] = useState(total);
  const [removed, setRemoved] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const scrollGroups = (() => {
    const seen = new Set<string>();
    return [...seedGroups, ...extra].filter((group) => {
      if (seen.has(group.key)) return false;
      seen.add(group.key);
      return true;
    });
  })();
  const hasMore = cursor < serverTotal;

  function handleDone() {
    // Gruppen er væk fra serverens liste: alt efter den rykker én plads op.
    setRemoved((n) => n + 1);
    setCursor((c) => Math.max(0, c - 1));
    setServerTotal((t) => Math.max(0, t - 1));
  }

  async function loadMore() {
    if (busy.current || !hasMore) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/duplicate-products/list?offset=${cursor}&limit=${perPage}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Kunne ikke hente flere");
      const data = (await res.json()) as { total: number; consumed: number; groups: CompareGroup[] };
      setExtra((current) => [...current, ...data.groups]);
      setCursor((c) => c + data.consumed);
      // Intet at hente mere, selvom tallet siger andet: undgå endeløs løkke.
      setServerTotal(data.consumed === 0 ? 0 : data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente flere");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  const groups = mode === "scroll" ? scrollGroups : initialGroups;
  const summary =
    mode === "scroll"
      ? `Viser ${scrollGroups.length} af ${serverTotal + removed}`
      : `Side ${page} af ${pages} · ${total} i alt`;

  return (
    <div className="flex flex-col gap-4">
      <ListModeToggle summary={summary} />

      {groups.length === 0 && !hasMore ? (
        <p className="hf-type-body text-text-secondary">Ingen vare-dubletter afventer gennemgang.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <DuplicateCompareGroup key={group.key} group={group} onDone={handleDone} />
          ))}
        </div>
      )}

      {mode === "scroll" && hasMore && <LoadMoreSentinel onVisible={loadMore} loading={loading} error={error} />}

      {mode === "pages" && pages > 1 && (
        <div className="hf-type-small flex items-center justify-between text-text-secondary">
          {page > 1 ? (
            <Link href={`/admin/duplicate-products?tab=varer&side=${page - 1}`} className="text-hf-green-dark">
              ← Forrige
            </Link>
          ) : (
            <span />
          )}
          <span>
            Side {page} af {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/duplicate-products?tab=varer&side=${page + 1}`} className="text-hf-green-dark">
              Næste →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
