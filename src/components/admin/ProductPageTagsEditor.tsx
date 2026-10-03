"use client";

import { useMemo, useState } from "react";
import {
  PRODUCT_PAGE_TAG_FIELDS,
  productPageTags,
  type ProductPageTagField,
  type ProductPageTagSettings,
} from "@/lib/product-page-tags";

// Valg af nøgleord til produktsiden (docs/DECISIONS.md 2026-10-02).

type KeywordCount = { keyword: string; count: number };

const numberFormat = new Intl.NumberFormat("da-DK");

export function ProductPageTagsEditor({
  initialSettings,
  keywords,
}: {
  initialSettings: ProductPageTagSettings;
  keywords: KeywordCount[];
}) {
  const [fields, setFields] = useState<Set<ProductPageTagField>>(() => new Set(initialSettings.fields));
  const [chosenKeywords, setChosenKeywords] = useState<Map<string, string>>(
    () => new Map(initialSettings.keywords.map((keyword) => [keyword.toLowerCase(), keyword])),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const visibleKeywords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle ? keywords.filter((row) => row.keyword.toLowerCase().includes(needle)) : keywords;
    // Valgte nøgleord, der ikke længere findes på nogen vare, vises stadig, så de kan fravælges.
    const known = new Set(keywords.map((row) => row.keyword.toLowerCase()));
    const orphans = [...chosenKeywords.entries()]
      .filter(([key, keyword]) => !known.has(key) && (!needle || key.includes(needle)) && keyword)
      .map(([, keyword]) => ({ keyword, count: 0 }));
    return [...orphans, ...list];
  }, [keywords, chosenKeywords, query]);

  // Eksempel med feltets eksempeltekster, så admin ser rækkefølgen.
  const preview = useMemo(() => {
    const filters: Record<string, string | number | string[]> = {};
    let flavor: string | null = null;
    for (const { field, example } of PRODUCT_PAGE_TAG_FIELDS) {
      if (field === "flavor") flavor = example;
      else if (field === "alcoholPercent") filters[field] = 4.6;
      else if (field === "fatPercent") filters[field] = 3.5;
      else if (field === "countryOfOrigin") filters[field] = "Danmark";
      else filters[field] = example;
    }
    const settings = { fields: [...fields], keywords: [...chosenKeywords.values()] };
    return productPageTags({ flavor, filters, keywords: settings.keywords.slice(0, 3) }, settings)
      .map((tag) =>
        tag.kind === "text"
          ? tag.text
          : tag.kind === "countryOfOrigin"
          ? `Fra ${tag.text}`
          : `${numberFormat.format(tag.value)} % ${tag.kind === "alcoholPercent" ? "alkohol" : "fedt"}`,
      )
      .join(" · ");
  }, [fields, chosenKeywords]);

  function toggleField(field: ProductPageTagField) {
    setStatus("idle");
    setFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function toggleKeyword(keyword: string) {
    setStatus("idle");
    setChosenKeywords((current) => {
      const next = new Map(current);
      const key = keyword.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.set(key, keyword);
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/product-page-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Gem i katalogets rækkefølge.
          fields: PRODUCT_PAGE_TAG_FIELDS.map((entry) => entry.field).filter((field) => fields.has(field)),
          keywords: [...chosenKeywords.values()],
        }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-title text-hf-black">Eksempel</h2>
        <p className="hf-type-body-lg mt-2 text-hf-black">{preview || "Intet valgt — linjen vises ikke."}</p>
      </section>

      <section className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-title text-hf-black">Felter</h2>
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {PRODUCT_PAGE_TAG_FIELDS.map(({ field, label, example }) => (
            <label key={field} className="hf-type-body flex min-h-11 items-center gap-2 text-hf-black">
              <input type="checkbox" checked={fields.has(field)} onChange={() => toggleField(field)} />
              <span>{label}</span>
              <span className="hf-type-small text-text-secondary">fx &quot;{example}&quot;</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="hf-type-title text-hf-black">Frie nøgleord</h2>
          <p className="hf-type-small text-text-secondary">
            {numberFormat.format(chosenKeywords.size)} valgt af {numberFormat.format(keywords.length)}
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søg i nøgleord"
          className="hf-type-input mt-2 w-full rounded-md border border-hf-tan-dark bg-hf-white px-3 py-2 text-hf-black"
        />
        {visibleKeywords.length === 0 ? (
          <p className="hf-type-body mt-3 text-text-secondary">
            {keywords.length === 0 ? "Ingen varer har nøgleord endnu." : "Ingen nøgleord matcher søgningen."}
          </p>
        ) : (
          <div className="mt-2 grid max-h-[480px] grid-cols-1 gap-x-6 overflow-y-auto sm:grid-cols-2">
            {visibleKeywords.map(({ keyword, count }) => (
              <label key={keyword.toLowerCase()} className="hf-type-body flex min-h-11 items-center gap-2 text-hf-black">
                <input
                  type="checkbox"
                  checked={chosenKeywords.has(keyword.toLowerCase())}
                  onChange={() => toggleKeyword(keyword)}
                />
                <span>{keyword}</span>
                <span className="hf-type-small text-text-secondary">
                  {count ? `${numberFormat.format(count)} varer` : "ikke på nogen vare"}
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="hf-control hf-btn-primary px-6 disabled:opacity-60"
        >
          {status === "saving" ? "Gemmer …" : "Gem"}
        </button>
        {status === "saved" && <p className="hf-type-body text-hf-green">Gemt — vises på produktsiden nu.</p>}
        {status === "error" && <p className="hf-type-body text-hf-red-dark">Kunne ikke gemme. Prøv igen.</p>}
      </div>
    </div>
  );
}
