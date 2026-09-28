"use client";

import { useEffect, useMemo, useState } from "react";
import { listAdditives, matchesAdditive, type AdditiveInfo } from "@/lib/additives";

export function AdditiveList() {
  const [additives, setAdditives] = useState<AdditiveInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listAdditives().then(setAdditives, () => setError(true));
  }, []);

  const filtered = useMemo(
    () => (additives ?? []).filter((a) => matchesAdditive(a, query)),
    [additives, query],
  );

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søg på E-nummer eller navn"
        aria-label="Søg E-numre"
        className="sticky top-0 mt-4 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-[#067a46]"
      />
      {error && <p className="mt-4 text-neutral-600">Kunne ikke hente E-numre.</p>}
      {!additives && !error && <p className="mt-4 text-neutral-600">Henter…</p>}
      {additives && filtered.length === 0 && <p className="mt-4 text-neutral-600">Ingen E-numre matcher søgningen.</p>}
      <ul className="mt-4 divide-y divide-neutral-200">
        {filtered.map((a) => (
          <li key={a.eNumber} className="py-3">
            <p className="font-semibold">
              {a.eNumber} <span className="font-normal">{a.danishName || a.internationalName}</span>
            </p>
            {a.function && <p className="text-sm text-neutral-600">{a.function}</p>}
            {a.risks && <p className="mt-1 text-sm text-neutral-600">{a.risks}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
