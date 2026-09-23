"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { REGIONS } from "@/lib/regions";
import type { SearchRankingWeights } from "@/lib/product-search-ranking";

type HistoryEntry = {
  id: string;
  weights: SearchRankingWeights;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
};

type PreviewResult = {
  id: string;
  type: "product" | "genericIngredient";
  name: string;
  score: number;
  similarity: number;
  breakdown: Record<keyof SearchRankingWeights | "similarity", number>;
};

type WeightCategory = {
  key: keyof SearchRankingWeights;
  title: string;
  description: string;
  signed?: boolean; // shows a "favors A ↔ favors B" bidirectional slider instead of a plain 0..100 one
  negativeLabel?: string;
  positiveLabel?: string;
};

const CATEGORIES: WeightCategory[] = [
  {
    key: "verification",
    title: "Verificering",
    description:
      "Er verificeret med stregkode, mindst 2 billeder af produktet, billede af varedeklaration og energifordeling.",
  },
  {
    key: "regionEan",
    title: "Regionale stregkoder (EAN)",
    description: "EAN-specifikke stregkoder for region.",
  },
  {
    key: "timeOfDay",
    title: "Tidspunkt",
    description: "Tid på dagen varen er søgt.",
  },
  {
    key: "regionBrand",
    title: "Regionale mærker",
    description: "Region-specifikke brands/mærker.",
  },
  {
    key: "genericVsProduct",
    title: "Ingrediens vs. vare",
    description: "Generiske ingredienser vs. varer.",
    signed: true,
    negativeLabel: "Favoriser varer",
    positiveLabel: "Favoriser ingredienser",
  },
  {
    key: "personalHistory",
    title: "Personlig historik",
    description:
      "Personligt tidligere søgte og klikkede produkter. Kan slettes af brugeren via \"Ret til at blive glemt\".",
  },
  {
    key: "regionalPopularity",
    title: "Regional popularitet",
    description: "Produktets egne søgninger/klik i regionen (eksisterende signal).",
  },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export function SearchRankingTuner({
  initialWeights,
  defaultWeights,
  activeId,
  initialHistory,
}: {
  initialWeights: SearchRankingWeights;
  defaultWeights: SearchRankingWeights;
  activeId: string | null;
  initialHistory: HistoryEntry[];
}) {
  const [weights, setWeights] = useState(initialWeights);
  const [history, setHistory] = useState(initialHistory);
  const [activeConfigId, setActiveConfigId] = useState(activeId);
  const [note, setNote] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("DK");
  const [hour, setHour] = useState(new Date().getHours());
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(weights) !== JSON.stringify(history.find((h) => h.id === activeConfigId)?.weights ?? initialWeights),
    [weights, history, activeConfigId, initialWeights]
  );

  const runPreview = useCallback(
    async (controller?: AbortController) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch("/api/admin/search-ranking/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, region, hour, weights }),
          signal: controller?.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Kunne ikke køre test-søgningen");
        setResults(data.results ?? []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setPreviewError(error instanceof Error ? error.message : "Kunne ikke køre test-søgningen");
      } finally {
        setPreviewLoading(false);
      }
    },
    [query, region, hour, weights]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => runPreview(controller), 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runPreview already depends on every input it reads
  }, [query, region, hour, weights]);

  function updateWeight(key: keyof SearchRankingWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  async function commit() {
    setCommitting(true);
    setCommitMessage(null);
    try {
      const res = await fetch("/api/admin/search-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      setActiveConfigId(data.config.id);
      setHistory((prev) => [
        {
          id: data.config.id,
          weights: data.config.weights,
          isActive: true,
          note: data.config.note,
          createdAt: data.config.createdAt,
          createdBy: null,
        },
        ...prev.map((entry) => ({ ...entry, isActive: false })),
      ]);
      setNote("");
      setCommitMessage("Gemt og aktiveret — bruges nu af den rigtige søgning.");
    } catch (error) {
      setCommitMessage(error instanceof Error ? error.message : "Kunne ikke gemme");
    } finally {
      setCommitting(false);
    }
  }

  async function restore(id: string) {
    setCommitting(true);
    setCommitMessage(null);
    try {
      const res = await fetch(`/api/admin/search-ranking/${id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gendanne");
      setWeights(data.config.weights);
      setActiveConfigId(data.config.id);
      setHistory((prev) => [
        {
          id: data.config.id,
          weights: data.config.weights,
          isActive: true,
          note: data.config.note,
          createdAt: data.config.createdAt,
          createdBy: null,
        },
        ...prev.map((entry) => ({ ...entry, isActive: false })),
      ]);
      setCommitMessage("Version gendannet og aktiveret.");
    } catch (error) {
      setCommitMessage(error instanceof Error ? error.message : "Kunne ikke gendanne");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border-strong bg-surface-2 p-4">
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-sm">
          <span className="text-text-secondary">Testsøgning</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Skriv en søgning for at teste live..."
            className="rounded-md border border-border-strong px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Region</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-border-strong px-3 py-2 text-sm"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Klokken (test)</span>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="rounded-md border border-border-strong px-3 py-2 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          {CATEGORIES.map((category) => (
            <details key={category.key} className="rounded-md border border-border-strong bg-surface-2" open>
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-text-primary">
                {category.title}
                <span className="ml-2 text-xs font-normal text-text-muted">({weights[category.key]})</span>
              </summary>
              <div className="flex flex-col gap-2 border-t border-border-strong px-4 py-3">
                <p className="text-xs text-text-secondary">{category.description}</p>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={weights[category.key]}
                  onChange={(e) => updateWeight(category.key, Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{category.signed ? category.negativeLabel : "Ingen effekt (0)"}</span>
                  <span>{category.signed ? category.positiveLabel : "Maksimal effekt (100)"}</span>
                </div>
              </div>
            </details>
          ))}

          <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-2 p-4">
            <p className="text-sm text-text-secondary">
              Ændringerne herover testes kun live i panelet til højre, indtil du klikker &quot;Commit&quot;. Den rigtige
              søgning i appen bruger stadig den senest aktiverede version.
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Valgfri note til denne version..."
              className="rounded-md border border-border-strong px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={commit}
                disabled={committing || !isDirty}
                className="rounded-md bg-hf-green-dark px-4 py-2 text-sm font-medium text-hf-white disabled:opacity-50"
              >
                {committing ? "Gemmer..." : "Commit — gør denne version aktiv"}
              </button>
              <button
                type="button"
                onClick={() => setWeights(defaultWeights)}
                className="rounded-md border border-border-strong px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan"
              >
                Nulstil til standard
              </button>
              {commitMessage && <span className="text-sm text-text-secondary">{commitMessage}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-2 p-4">
            <h2 className="text-sm font-medium text-text-primary">Tidligere versioner (backup)</h2>
            <ul className="flex flex-col gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-strong px-3 py-2 text-xs"
                >
                  <div>
                    <div className={entry.isActive ? "font-medium text-hf-green-dark" : "text-text-secondary"}>
                      {entry.isActive ? "Aktiv" : "Inaktiv"} — {formatDate(entry.createdAt)}
                    </div>
                    {entry.note && <div className="text-text-muted">{entry.note}</div>}
                  </div>
                  {!entry.isActive && (
                    <button
                      type="button"
                      onClick={() => restore(entry.id)}
                      disabled={committing}
                      className="rounded-md border border-border-strong px-2 py-1 text-text-secondary hover:bg-hf-tan"
                    >
                      Gendan
                    </button>
                  )}
                </li>
              ))}
              {history.length === 0 && <li className="text-xs text-text-muted">Ingen versioner committet endnu.</li>}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-2 p-4">
          <h2 className="text-sm font-medium text-text-primary">Live testresultat</h2>
          {previewLoading && <p className="text-xs text-text-muted">Søger...</p>}
          {previewError && <p className="text-xs text-hf-red-dark">{previewError}</p>}
          {!previewLoading && !previewError && query.trim() === "" && (
            <p className="text-xs text-text-muted">Skriv en testsøgning ovenfor for at se resultatet.</p>
          )}
          <ul className="flex flex-col gap-2">
            {results.map((result, index) => (
              <li key={`${result.type}-${result.id}`} className="rounded-md border border-border-strong px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">
                    {index + 1}. {result.name}
                  </span>
                  <span className="text-text-muted">
                    {result.type === "genericIngredient" ? "Ingrediens" : "Vare"} · score {result.score}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-text-muted">
                  {Object.entries(result.breakdown)
                    .filter(([, value]) => value !== 0)
                    .map(([signal, value]) => (
                      <span key={signal} className="rounded bg-hf-tan px-1.5 py-0.5">
                        {signal}: {Math.round(value * 100) / 100}
                      </span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
