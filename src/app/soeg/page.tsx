"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Result = { id: string; title: string; image?: string };

const previouslyAdded: Result[] = [
  { id: "p1", title: "Rugbrød m. kerner, Schulstad", image: "/dummy/rugbroed.png" },
];
const favorites: Result[] = [
  { id: "f1", title: "Groft rugbrød, Kohberg", image: "/dummy/rugbroed.png" },
];

// Vises hvis /api/products (databasen) ikke kan svare — sker i dette
// sandbox-miljø uden en kørende Postgres, men lader UI'et forblive brugbart.
const fallbackResults: Result[] = [
  { id: "r1", title: "Kernerugbrød, Rema 1000", image: "/dummy/rugbroed.png" },
  { id: "r2", title: "Rugbrød med solsikkekerner, Lidl", image: "/dummy/rugbroed.png" },
  { id: "r3", title: "Rugkerner-snitter, Kohberg", image: "/dummy/rugbroed.png" },
];

function ResultRow({ id, title, image }: { id: string; title: string; image?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hf-tan-dark last:border-b-0">
      <div className="h-10 w-10 flex-shrink-0">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-contain" />
        )}
      </div>
      <span className="flex-1 text-[15px] font-medium text-hf-black">{title}</span>
      <Link href={`/tilfoej/${id}`} className="hf-btn-primary px-4 py-1.5 text-xs">
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
          data.products.map((p: { id: string; name: string; imageUrl?: string | null }) => ({
            id: p.id,
            title: p.name,
            image: p.imageUrl ?? undefined,
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
        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg fødevare eller ret"
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
                <ResultRow key={r.id} id={r.id} title={r.title} image={r.image} />
              ))}
            </div>

            <p className="text-xs font-bold text-hf-black">Favoritter</p>
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              {favorites.map((r) => (
                <ResultRow key={r.id} id={r.id} title={r.title} image={r.image} />
              ))}
            </div>
          </>
        )}

        <p className="text-xs font-bold text-hf-black">
          {query.trim() ? "Søgeresultater" : "Alle varer"}
        </p>
        <div className="overflow-hidden rounded-2xl bg-hf-tan">
          {results.slice(0, 6).map((r) => (
            <ResultRow key={r.id} id={r.id} title={r.title} image={r.image} />
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
