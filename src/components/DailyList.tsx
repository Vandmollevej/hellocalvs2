"use client";

import { useState } from "react";
import Link from "next/link";
import { SwipeableRow } from "@/components/SwipeableRow";

type Entry = {
  id: string;
  title: string;
  kcal: number;
  time: string;
  favorite?: boolean;
};

const initialEntries: Entry[] = [
  { id: "1", title: "Kyllingesalat med avocado, ristede kerner og citronvinaigrette", kcal: 480, time: "18:20" },
  { id: "2", title: "Rugbrød med skinke, tomat og lidt smør", kcal: 310, time: "13:05" },
  { id: "3", title: "Havregrød med blåbær og honning", kcal: 450, time: "08:10" },
];

export function DailyList() {
  const [entries, setEntries] = useState(initialEntries);

  return (
    <div className="relative">
      <ul className="px-4">
        {entries.map((entry, i) => (
          <li
            key={entry.id}
            className={i < entries.length - 1 ? "border-b border-hf-tan-dark" : ""}
          >
            <SwipeableRow
              onFavorite={() =>
                setEntries((prev) =>
                  prev.map((e) => (e.id === entry.id ? { ...e, favorite: !e.favorite } : e))
                )
              }
              onDelete={() =>
                setEntries((prev) => prev.filter((e) => e.id !== entry.id))
              }
            >
              <Link
                href={`/registrering/${entry.id}`}
                className="flex items-start gap-2.5 py-2.5"
              >
                <div className="h-11 w-11 flex-shrink-0 rounded-lg bg-hf-tan" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-hf-black">
                    {entry.title}
                    {entry.favorite && " ★"}
                  </p>
                  <div className="mt-0.5 flex justify-between">
                    <span className="text-xs text-hf-black opacity-60">{entry.kcal} kcal</span>
                    <span className="text-xs text-hf-black opacity-60">Oprettet kl. {entry.time}</span>
                  </div>
                </div>
              </Link>
            </SwipeableRow>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="py-6 text-center text-sm text-hf-black opacity-60">
            Ingen registreringer i dag
          </li>
        )}
      </ul>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-9"
        style={{ background: "linear-gradient(to bottom, transparent, var(--hf-cream))" }}
      />
    </div>
  );
}
