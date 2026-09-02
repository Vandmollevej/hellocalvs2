"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { SwipeableRow } from "@/components/SwipeableRow";

type Entry = {
  id: string;
  title: string;
  kcalPer100g: number;
  createdAt: string;
  image?: string;
};

type RegistrationResponse = {
  registrations: Array<{
    id: string;
    titleSnapshot: string;
    kcalSnapshot: number;
    amountGrams: number;
    createdAt: string;
    product: { imageUrl: string | null } | null;
  }>;
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

export function DailyList() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/registrations")
      .then(async (res) => {
        if (!res.ok) throw new Error("Kunne ikke hente registreringer");
        const data = (await res.json()) as RegistrationResponse;
        setEntries(
          data.registrations
            .filter((registration) => isToday(registration.createdAt))
            .map((registration) => ({
              id: registration.id,
              title: registration.titleSnapshot,
              kcalPer100g:
                registration.amountGrams > 0
                  ? (registration.kcalSnapshot / registration.amountGrams) * 100
                  : registration.kcalSnapshot,
              createdAt: registration.createdAt,
              image: registration.product?.imageUrl ?? undefined,
            }))
        );
      })
      .catch(() => setError("Kunne ikke hente dagens registreringer"))
      .finally(() => setLoading(false));
  }, []);

  async function deleteEntry(id: string) {
    const previousEntries = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));

    try {
      const res = await fetch(`/api/registrations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Kunne ikke slette registreringen");
    } catch {
      setEntries(previousEntries);
      setError("Kunne ikke slette registreringen");
    }
  }

  return (
    <div className="relative">
      <ul className="px-4">
        {entries.map((entry, i) => (
          <li
            key={entry.id}
            className={i < entries.length - 1 ? "border-b border-hf-tan-dark" : ""}
          >
            <SwipeableRow
              onDelete={() => void deleteEntry(entry.id)}
            >
              <Link
                href={`/registration/${entry.id}`}
                className="flex items-center gap-2.5 py-2.5"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
                  {entry.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.image} alt="" className="h-full w-full object-contain object-center" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-hf-black">
                    {entry.title}
                  </p>
                  <div className="mt-0.5 flex justify-between">
                    <span className="text-xs text-hf-black opacity-60">
                      {Math.round(entry.kcalPer100g)} kcal / 100 g
                    </span>
                    <span className="text-xs text-hf-black opacity-60">Kl. {formatTime(entry.createdAt)}</span>
                  </div>
                </div>
                <IconChevronRight size={18} className="flex-shrink-0 text-hf-black opacity-40" />
              </Link>
            </SwipeableRow>
          </li>
        ))}
        {loading && (
          <li className="py-6 text-center text-sm text-hf-black opacity-60">Henter dagens registreringer...</li>
        )}
        {!loading && entries.length === 0 && (
          <li className="py-6 text-center text-sm text-hf-black opacity-60">
            Ingen registreringer i dag
          </li>
        )}
        {error && <li className="pb-3 text-center text-xs text-red-700">{error}</li>}
      </ul>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-9"
        style={{ background: "linear-gradient(to bottom, transparent, var(--hf-cream))" }}
      />
    </div>
  );
}
