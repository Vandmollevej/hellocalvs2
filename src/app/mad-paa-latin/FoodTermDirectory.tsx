"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import { FOOD_TERMS, foodTermAnchor, matchesFoodTerm } from "@/lib/food-latin";

export function FoodTermDirectory() {
  const [query, setQuery] = useState("");
  const [activeAnchor, setActiveAnchor] = useState("");

  const visible = useMemo(
    () =>
      [...FOOD_TERMS]
        .sort((a, b) => a.term.localeCompare(b.term, "da"))
        .filter((item) => matchesFoodTerm(item, query)),
    [query],
  );

  // Fremhæv og scroll til det ord, der er linket til (#dextrose).
  useEffect(() => {
    const sync = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      setActiveAnchor(anchor);
      if (anchor) {
        setQuery("");
        requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="min-h-dvh bg-hf-white text-hf-black">
      <div className="sticky top-0 z-10 border-b border-hf-tan-dark bg-hf-white px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Tilbage" className="flex h-8 w-8 items-center justify-center rounded-full">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="hf-type-title hf-heading">Mad på latin</h1>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-hf-tan px-4 py-2">
            <IconSearch size={18} className="text-text-secondary" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg på ingrediens"
              className="hf-type-body w-full bg-transparent outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-4">
        {visible.length === 0 && (
          <p className="hf-type-body text-text-secondary">Ingen ingredienser matcher din søgning.</p>
        )}
        {visible.map((item) => {
          const anchor = foodTermAnchor(item.term);
          return (
            <section
              key={item.term}
              id={anchor}
              className={`scroll-mt-32 rounded-2xl border p-4 ${
                activeAnchor === anchor ? "border-hf-green" : "border-hf-black/10"
              }`}
            >
              <h2 className="hf-type-body hf-heading">{item.term}</h2>
              <p className="hf-type-small text-text-secondary">På dansk: {item.danish}</p>
              <p className="hf-type-body mt-2">{item.explanation}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
