"use client";

import { useMemo, useState } from "react";
import {
  PRODUCT_PAGE_TAG_FIELDS,
  productPageTags,
  type ProductPageTagField,
  type ProductPageTagSettings,
} from "@/lib/product-page-tags";
import {
  PRODUCT_KEYWORD_GROUPS,
  displayProductKeyword,
  productKeywordGroup,
  type ProductKeywordGroup,
} from "@/lib/product-keyword-groups";

// Valg af nøgleordstyper og -grupper til produktsiden
// (docs/DECISIONS.md 2026-10-02 + 2026-10-07).

type KeywordCount = { keyword: string; count: number };

const numberFormat = new Intl.NumberFormat("da-DK");
const FIELD_EXAMPLES = new Map(PRODUCT_PAGE_TAG_FIELDS.map((entry) => [entry.field, entry.example]));

export function ProductPageTagsEditor({
  initialSettings,
  keywords,
}: {
  initialSettings: ProductPageTagSettings;
  keywords: KeywordCount[];
}) {
  const [fields, setFields] = useState<Set<ProductPageTagField>>(() => new Set(initialSettings.fields));
  const [groups, setGroups] = useState<Set<ProductKeywordGroup>>(() => new Set(initialSettings.groups));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Nøgleordene i databasen fordelt på grupper (mest brugte først).
  const byGroup = useMemo(() => {
    const map = new Map<ProductKeywordGroup, { keywords: KeywordCount[]; products: number }>();
    for (const row of keywords) {
      const group = productKeywordGroup(row.keyword);
      if (!group) continue;
      const entry = map.get(group) ?? { keywords: [], products: 0 };
      entry.keywords.push(row);
      entry.products += row.count;
      map.set(group, entry);
    }
    return map;
  }, [keywords]);

  // Eksempel med eksempeltekster (på dansk), så admin ser rækkefølgen.
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
    const sampleKeywords = PRODUCT_KEYWORD_GROUPS.map(
      ({ group, example }) => byGroup.get(group)?.keywords[0]?.keyword ?? example.split(",")[0],
    );
    return productPageTags({ flavor, filters, keywords: sampleKeywords }, { fields: [...fields], groups: [...groups] })
      .map((tag) =>
        tag.kind === "text"
          ? tag.text
          : tag.kind === "flag"
          ? FIELD_EXAMPLES.get(tag.field) ?? tag.field
          : tag.kind === "countryOfOrigin"
          ? `Fra ${tag.text}`
          : `${numberFormat.format(tag.value)} % ${tag.kind === "alcoholPercent" ? "alkohol" : "fedt"}`,
      )
      .join(" · ");
  }, [fields, groups, byGroup]);

  function toggle<T>(setter: (update: (current: Set<T>) => Set<T>) => void, value: T) {
    setStatus("idle");
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/product-page-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Gem i katalogets rækkefølge.
        body: JSON.stringify({
          fields: PRODUCT_PAGE_TAG_FIELDS.map((entry) => entry.field).filter((field) => fields.has(field)),
          groups: PRODUCT_KEYWORD_GROUPS.map((entry) => entry.group).filter((group) => groups.has(group)),
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
        <h2 className="hf-type-title text-hf-black">Faste typer</h2>
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {PRODUCT_PAGE_TAG_FIELDS.map(({ field, label, example }) => (
            <label key={field} className="hf-type-body flex min-h-11 items-center gap-2 text-hf-black">
              <input type="checkbox" checked={fields.has(field)} onChange={() => toggle(setFields, field)} />
              <span>{label}</span>
              <span className="hf-type-small text-text-secondary">fx &quot;{example}&quot;</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-title text-hf-black">Nøgleordsgrupper fra produktarkene</h2>
        <p className="hf-type-small mt-1 text-text-secondary">
          Nøgleord uden gruppe (fx mærkenavne og afkortede ord) vises ikke.
        </p>
        <div className="mt-2 flex flex-col">
          {PRODUCT_KEYWORD_GROUPS.map(({ group, label, example }) => {
            const entry = byGroup.get(group);
            const samples = entry?.keywords.slice(0, 12).map((row) => displayProductKeyword(row.keyword));
            return (
              <label key={group} className="hf-type-body flex min-h-11 items-start gap-2 py-1 text-hf-black">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={groups.has(group)}
                  onChange={() => toggle(setGroups, group)}
                />
                <span className="flex flex-col">
                  <span>
                    {label}
                    {entry && (
                      <span className="hf-type-small text-text-secondary">
                        {" "}
                        · {numberFormat.format(entry.keywords.length)} forskellige,{" "}
                        {numberFormat.format(entry.products)} gange i alt
                      </span>
                    )}
                  </span>
                  <span className="hf-type-small text-text-secondary">
                    {samples?.length ? samples.join(", ") : `fx ${example}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
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
