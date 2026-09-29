"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconChevronRight, IconSearch } from "@tabler/icons-react";

export type DirectoryItem = {
  code: string;
  nameDa: string;
  nameEn: string;
  category: string;
  summary: string;
  euStatus: "approved" | "banned" | "not_approved";
  variants: string;
};

type StatusFilter = "all" | "approved" | "other";

// Nummerområderne fra EU's klassifikation.
const RANGES: Array<{ label: string; from: number; to: number }> = [
  { label: "Farvestoffer (E100–E199)", from: 100, to: 199 },
  { label: "Konserveringsmidler (E200–E299)", from: 200, to: 299 },
  { label: "Antioxidanter og surhedsregulerende midler (E300–E399)", from: 300, to: 399 },
  { label: "Fortykningsmidler, stabilisatorer og emulgatorer (E400–E499)", from: 400, to: 499 },
  { label: "Surhedsregulerende og antiklumpningsmidler (E500–E599)", from: 500, to: 599 },
  { label: "Smagsforstærkere (E600–E699)", from: 600, to: 699 },
  { label: "Antibiotika (E700–E799)", from: 700, to: 799 },
  { label: "Overfladebehandling, gasser og sødestoffer (E900–E999)", from: 800, to: 999 },
  { label: "Øvrige stoffer (E1000+)", from: 1000, to: 99999 },
];

function numericPart(code: string) {
  return Number.parseInt(code.replace(/\D/g, ""), 10) || 0;
}

export function ENumberDirectory({ items }: { items: DirectoryItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Gamle links (/e-numre#e330) sendes videre til nummerets egen side.
  useEffect(() => {
    const anchor = decodeURIComponent(window.location.hash.slice(1));
    if (anchor) router.replace(`/e-numre/${encodeURIComponent(anchor.toUpperCase())}`);
  }, [router]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const compact = q.replace(/[^a-z0-9]/g, "").replace(/^e/, "");
    return items.filter((item) => {
      if (status === "approved" && item.euStatus !== "approved") return false;
      if (status === "other" && item.euStatus === "approved") return false;
      if (!q) return true;
      const code = item.code.toLowerCase().replace(/^e/, "");
      if (compact && code.startsWith(compact)) return true;
      return [item.nameDa, item.nameEn, item.category, item.variants].some((text) =>
        text.toLowerCase().includes(q),
      );
    });
  }, [items, query, status]);

  const groups = RANGES.map((range) => ({
    label: range.label,
    items: visible.filter((item) => {
      const n = numericPart(item.code);
      return n >= range.from && n <= range.to;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-dvh bg-hf-white text-hf-black">
      <div className="sticky top-0 z-10 border-b border-hf-tan-dark bg-hf-white px-4 pb-3 pt-4">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Tilbage" className="flex h-8 w-8 items-center justify-center rounded-full">
              <IconArrowLeft size={20} />
            </Link>
            <h1 className="hf-type-title hf-heading">E-numre</h1>
            <span className="hf-type-small ml-auto text-text-secondary">{visible.length} stoffer</span>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-hf-tan px-4 py-2">
            <IconSearch size={18} className="text-text-secondary" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg på E-nummer, navn eller funktion"
              className="hf-type-body w-full bg-transparent outline-none"
            />
          </label>
          <div className="flex gap-2">
            {(
              [
                ["all", "Alle"],
                ["approved", "Godkendt i EU"],
                ["other", "Forbudt/ikke godkendt"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`hf-type-small rounded-full px-3 py-1 ${
                  status === value ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-4">
        {groups.length === 0 && (
          <p className="hf-type-body text-text-secondary">Ingen E-numre matcher din søgning.</p>
        )}
        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            <h2 className="hf-type-small hf-heading uppercase text-text-secondary">{group.label}</h2>
            <ul className="flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item.code}>
                  <Link
                    href={`/e-numre/${encodeURIComponent(item.code)}`}
                    className="flex items-center gap-3 rounded-2xl bg-hf-tan p-3"
                  >
                    <span className="hf-type-body hf-heading w-16 shrink-0">{item.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="hf-type-body block">{item.nameDa || item.nameEn}</span>
                      <span className="hf-type-small line-clamp-2 block text-text-secondary">
                        {item.euStatus !== "approved" && (
                          <span className="hf-heading text-hf-red-dark">
                            {item.euStatus === "banned" ? "Forbudt i EU · " : "Ikke godkendt i EU · "}
                          </span>
                        )}
                        {item.category}
                        {item.summary ? ` — ${item.summary}` : ""}
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-text-secondary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="hf-type-small text-text-secondary">
          Generel baggrundsinformation baseret på EFSA, JECFA og fagfællebedømt forskning — ikke
          personlig kostrådgivning.
        </p>
      </div>
    </div>
  );
}
