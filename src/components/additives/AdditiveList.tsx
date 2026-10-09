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
        className="sticky top-0 mt-4 w-full rounded-xl border px-4 py-3 outline-none border-hf-line bg-hf-white hf-type-body-lg focus:border-hf-brand"
      />
      {error && <p className="mt-4 text-hf-text-secondary">Kunne ikke hente E-numre.</p>}
      {!additives && !error && <p className="mt-4 text-hf-text-secondary">Henter…</p>}
      {additives && filtered.length === 0 && <p className="mt-4 text-hf-text-secondary">Ingen E-numre matcher søgningen.</p>}
      <ul className="mt-4 divide-y divide-hf-nav">
        {filtered.map((a) => (
          <li key={a.eNumber} className="py-3">
            <p className="hf-type-strong">
              {a.eNumber} <span className="">{a.danishName || a.internationalName}</span>
            </p>
            {a.function && <p className="text-hf-text-secondary hf-type-body">{a.function}</p>}
            {a.risks && <p className="mt-1 text-hf-text-secondary hf-type-body">{a.risks}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
