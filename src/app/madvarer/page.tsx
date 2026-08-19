"use client";

import { useMemo, useState } from "react";
import { IconSearch, IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

type Tab = "madvarer" | "drikkevarer" | "retter";

type Item = { id: string; title: string; tab: Tab; favorite: boolean; image?: string };

const items: Item[] = [
  { id: "1", title: "Rugbrød m. kerner, Schulstad", tab: "madvarer", favorite: true, image: "/dummy/rugbroed.png" },
  { id: "2", title: "Letmælk 0,5%, Arla", tab: "drikkevarer", favorite: false },
  { id: "3", title: "Havregrød med blåbær", tab: "retter", favorite: true },
  { id: "4", title: "Kyllingesalat med avocado", tab: "retter", favorite: false },
  { id: "5", title: "Skyr, naturel", tab: "madvarer", favorite: false, image: "/dummy/skyr.png" },
];

const tabs: { key: Tab; label: string }[] = [
  { key: "madvarer", label: "Madvarer" },
  { key: "drikkevarer", label: "Drikkevarer" },
  { key: "retter", label: "Retter" },
];

export default function MadvarerPage() {
  const [tab, setTab] = useState<Tab>("madvarer");
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (i.tab !== tab) return false;
      if (onlyFavorites && !i.favorite) return false;
      if (query.trim() && !i.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [tab, query, onlyFavorites]);

  return (
    <HfScreen title="Gemte madvarer">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 rounded-full border border-hf-tan-dark bg-hf-white px-3.5 py-2.5">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søg i mit bibliotek"
            className="flex-1 bg-transparent text-sm text-hf-black outline-none placeholder:opacity-60"
          />
        </div>

        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                tab === t.key
                  ? "bg-hf-black text-hf-white"
                  : "bg-hf-tan text-hf-black"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-pressed={onlyFavorites}
            aria-label="Vis kun gemte"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(26,26,23,0.45)" }}
          >
            {onlyFavorites ? (
              <IconBookmarkFilled size={15} color="var(--hf-white)" />
            ) : (
              <IconBookmark size={15} stroke={1.5} color="var(--hf-white)" />
            )}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-hf-tan">
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 px-4 py-3 ${
                i < filtered.length - 1 ? "border-b border-hf-tan-dark" : ""
              }`}
            >
              <div className="h-10 w-10 flex-shrink-0">
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" className="h-full w-full object-contain" />
                )}
              </div>
              <span className="flex-1 text-[15px] font-medium text-hf-black">
                {item.title}
              </span>
              {item.favorite && (
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(26,26,23,0.55)" }}
                >
                  <IconBookmark size={16} stroke={2} color="var(--hf-white)" />
                </span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-hf-black opacity-60">
              Ingen varer i denne fane endnu
            </p>
          )}
        </div>
      </div>
    </HfScreen>
  );
}
