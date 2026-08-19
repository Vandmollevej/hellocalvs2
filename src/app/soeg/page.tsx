"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Result = { id: string; title: string };

const previouslyAdded: Result[] = [
  { id: "p1", title: "Rugbrød m. kerner, Schulstad" },
];
const favorites: Result[] = [{ id: "f1", title: "Groft rugbrød, Kohberg" }];

// Vises hvis /api/products (databasen) ikke kan svare — sker i dette
// sandbox-miljø uden en kørende Postgres, men lader UI'et forblive brugbart.
const fallbackResults: Result[] = [
  { id: "r1", title: "Kernerugbrød, Rema 1000" },
  { id: "r2", title: "Rugbrød med solsikkekerner, Lidl" },
  { id: "r3", title: "Rugkerner-snitter, Kohberg" },
];

function ResultRow({ id, title }: { id: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hf-tan-dark last:border-b-0">
      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-hf-white" />
      <span className="flex-1 text-[15px] font-medium text-hf-black">{title}</span>
      <Link
        href={`/tilfoej/${id}`}
        className="rounded-full bg-hf-black px-4 py-1.5 text-xs font-bold text-hf-white"
      >
        Tilføj
      </Link>
    </div>
  );
}

export default function SoegPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>(fallbackResults);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        setResults(
          data.products.map((p: { id: string; name: string }) => ({
            id: p.id,
            title: p.name,
          }))
        );
        setOffline(false);
      } catch {
        setOffline(true);
        setResults(
          query.trim()
            ? fallbackResults.filter((r) =>
                r.title.toLowerCase().includes(query.toLowerCase())
              )
            : fallbackResults
        );
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <HfScreen title="Søg">
      <div className="flex flex-col gap-3.5 p-4">
        <div className="flex items-center gap-2 rounded-full border border-hf-tan-dark bg-hf-white px-3.5 py-2.5">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg fødevare eller ret"
            className="flex-1 bg-transparent text-sm text-hf-black outline-none placeholder:opacity-60"
          />
        </div>

        {offline && (
          <p className="text-xs text-hf-black opacity-60">
            Database ikke tilgængelig lige nu — viser eksempeldata.
          </p>
        )}

        {!query.trim() && (
          <>
            <p className="text-xs font-bold text-hf-black">Tidligere tilføjet</p>
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              {previouslyAdded.map((r) => (
                <ResultRow key={r.id} id={r.id} title={r.title} />
              ))}
            </div>

            <p className="text-xs font-bold text-hf-black">Favoritter</p>
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              {favorites.map((r) => (
                <ResultRow key={r.id} id={r.id} title={r.title} />
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-bold text-hf-black">
          {query.trim() ? "Søgeresultater" : "Alle varer"}
        </p>
        <div className="overflow-hidden rounded-2xl bg-hf-tan">
          {results.slice(0, 6).map((r) => (
            <ResultRow key={r.id} id={r.id} title={r.title} />
          ))}
          {results.length === 0 && (
            <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
              Ingen resultater
            </p>
          )}
        </div>
      </div>
    </HfScreen>
  );
}
