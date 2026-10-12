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
      <div className="hf-directory-toolbar">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Tilbage" className="hf-icon-circle-sm">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="hf-type-title hf-heading">Mad på latin</h1>
          </div>
          <label className="hf-directory-filter">
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
        {!query && (
          <nav aria-label="Alle ord" className="hf-type-small flex flex-wrap gap-x-3 gap-y-1">
            {visible.map((item) => (
              <a key={item.term} href={`#${foodTermAnchor(item.term)}`} className="text-hf-green">
                {item.term}
              </a>
            ))}
          </nav>
        )}
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
              <h2 className="hf-type-body hf-heading">
                <a href={`#${anchor}`}>{item.term}</a>
              </h2>
              <p className="hf-type-caption">På dansk: {item.danish}</p>
              <p className="hf-type-body mt-2">{item.explanation}</p>
              <p className="hf-type-caption mt-2">
                Kilde:{" "}
                <a href={item.source.href} target="_blank" rel="noreferrer" className="text-hf-green underline underline-offset-2">
                  {item.source.label}
                </a>
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
