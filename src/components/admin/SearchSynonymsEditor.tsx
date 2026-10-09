"use client";

import { useState } from "react";

type Synonym = { id: string; language: "DA" | "EN"; termA: string; termB: string; similarity: number };

const LANGUAGES: { value: Synonym["language"]; label: string }[] = [
  { value: "DA", label: "Dansk" },
  { value: "EN", label: "Engelsk" },
];

const FIELD = "hf-type-body hf-field rounded-md border border-hf-tan-dark px-3";

export function SearchSynonymsEditor({ initial }: { initial: Synonym[] }) {
  const [items, setItems] = useState(initial);
  const [language, setLanguage] = useState<Synonym["language"]>("DA");
  const [termA, setTermA] = useState("");
  const [termB, setTermB] = useState("");
  const [similarity, setSimilarity] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function add() {
    setError(null);
    const res = await fetch("/api/admin/search-synonyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, termA, termB, similarity }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message ?? "Kunne ikke gemme");
      return;
    }
    setItems((prev) => [...prev, data.synonym]);
    setTermA("");
    setTermB("");
  }

  async function saveSimilarity(id: string, value: number) {
    const res = await fetch(`/api/admin/search-synonyms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ similarity: value }),
    });
    if (res.ok) {
      const { synonym } = await res.json();
      setItems((prev) => prev.map((s) => (s.id === id ? synonym : s)));
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/search-synonyms/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  const f = filter.trim().toLowerCase();
  const visible = f ? items.filter((s) => s.termA.includes(f) || s.termB.includes(f)) : items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-hf-tan-dark bg-hf-white p-4">
        <label className="hf-type-body flex flex-col gap-1">
          <span className="text-text-secondary">Sprog</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Synonym["language"])} className={FIELD}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="hf-type-body flex min-w-[140px] flex-1 flex-col gap-1">
          <span className="text-text-secondary">Ord 1</span>
          <input value={termA} onChange={(e) => setTermA(e.target.value)} placeholder="gris" className={FIELD} />
        </label>
        <label className="hf-type-body flex min-w-[140px] flex-1 flex-col gap-1">
          <span className="text-text-secondary">Ord 2</span>
          <input value={termB} onChange={(e) => setTermB(e.target.value)} placeholder="svin" className={FIELD} />
        </label>
        <label className="hf-type-body flex flex-col gap-1">
          <span className="text-text-secondary">Ens (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={similarity}
            onChange={(e) => setSimilarity(Number(e.target.value))}
            className={`${FIELD} w-24`}
          />
        </label>
        <button type="button" onClick={add} className="hf-type-body hf-field rounded-md bg-hf-black px-4 text-hf-white">
          Tilføj
        </button>
        {error && <p className="hf-type-body w-full text-red-600">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Søg i ordbogen"
          className={`${FIELD} max-w-sm`}
        />
        {visible.length === 0 && <p className="hf-type-body text-text-secondary">Ingen synonymer endnu.</p>}
        {visible.map((s) => (
          <SynonymRow key={s.id} synonym={s} onSave={saveSimilarity} onDelete={remove} />
        ))}
      </div>
    </div>
  );
}

function SynonymRow({
  synonym,
  onSave,
  onDelete,
}: {
  synonym: Synonym;
  onSave: (id: string, value: number) => void;
  onDelete: (id: string) => void;
}) {
  const [value, setValue] = useState(synonym.similarity);
  const commit = () => {
    if (value !== synonym.similarity) onSave(synonym.id, value);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2">
      <span className="hf-type-body w-16 text-text-secondary">{synonym.language === "DA" ? "Dansk" : "Engelsk"}</span>
      <span className="hf-type-body min-w-[200px] flex-1 text-hf-black">
        {synonym.termA} ↔ {synonym.termB}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="w-40"
        aria-label="Ens i procent"
      />
      <span className="hf-type-body w-12 text-right">{value} %</span>
      <button type="button" onClick={() => onDelete(synonym.id)} className="hf-type-body text-red-600">
        Slet
      </button>
    </div>
  );
}
