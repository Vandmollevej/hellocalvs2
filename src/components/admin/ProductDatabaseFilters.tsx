"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_DATABASE_SORTS,
  PRODUCT_SOURCES,
  PRODUCT_SOURCE_LABELS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  productDatabaseHref,
  type ProductDatabaseFilters as Filters,
} from "@/lib/admin-product-database-query";

// Filterbjælken til admin "Produkt-database". Hvert valg skriver direkte til
// URL'en; serveren henter så den filtrerede side (docs/DECISIONS.md 2026-09-27).

const fieldClass = "hf-type-body hf-field w-full min-w-0 rounded-md border border-hf-tan-dark bg-hf-white px-3 text-hf-black";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="hf-type-label text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="hf-type-label text-text-secondary">{label}</span>
      <div className="flex gap-1 rounded-md border border-hf-tan-dark bg-hf-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="hf-choice flex-1"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Tekstfelt med forslag (datalist). Et valg fra listen anvendes med det samme;
// fri tekst anvendes ved Enter eller når feltet forlades.
function SuggestField({
  id,
  label,
  placeholder,
  value,
  suggestions,
  onApply,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  suggestions: string[];
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger URL'en (fx "Nulstil")
    setDraft(value);
  }, [value]);

  function apply(next: string) {
    const trimmed = next.trim();
    if (trimmed !== value) onApply(trimmed);
  }

  return (
    <Field label={label}>
      <input
        list={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const exact = suggestions.find((s) => s.toLowerCase() === next.trim().toLowerCase());
          if (next.trim() === "" || exact) apply(exact ?? "");
        }}
        onBlur={() => apply(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply(draft);
          }
        }}
        className={`${fieldClass} placeholder:text-text-muted`}
      />
      <datalist id={id}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

export function ProductDatabaseFilters({
  filters,
  stores,
  categories,
  brands,
  subbrands,
}: {
  filters: Filters;
  stores: { id: string; name: string; count: number }[];
  categories: { id: string; name: string }[];
  brands: string[];
  subbrands: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(true);
  const lastPushedQuery = useRef(filters.q);

  function go(changes: Partial<Filters>) {
    startTransition(() => {
      router.push(productDatabaseHref(filters, changes), { scroll: false });
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger URL'en (tilbage-knap, "Nulstil")
    setQuery(filters.q);
    lastPushedQuery.current = filters.q;
  }, [filters.q]);

  // Søgningen opdateres mens der skrives, med en kort pause mellem tastetryk.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === lastPushedQuery.current) return;
    const timer = window.setTimeout(() => {
      lastPushedQuery.current = trimmed;
      startTransition(() => {
        router.replace(productDatabaseHref(filters, { q: trimmed }), { scroll: false });
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, filters, router]);

  const storeName = stores.find((s) => s.id === filters.store)?.name;
  const categoryName = categories.find((c) => c.id === filters.category)?.name;
  const chips: { label: string; clear: Partial<Filters> }[] = [];
  if (filters.store) chips.push({ label: filters.store === "none" ? "Ingen kæde" : `Kæde: ${storeName ?? "ukendt"}`, clear: { store: "" } });
  if (filters.brand) chips.push({ label: `Mærke: ${filters.brand}`, clear: { brand: "", subbrand: "" } });
  if (filters.subbrand) chips.push({ label: `Sub brand: ${filters.subbrand}`, clear: { subbrand: "" } });
  if (filters.category)
    chips.push({ label: filters.category === "none" ? "Uden kategori" : `Kategori: ${categoryName ?? "ukendt"}`, clear: { category: "" } });
  if (filters.productCategory)
    chips.push({ label: `Varetype: ${PRODUCT_CATEGORY_LABELS[filters.productCategory]}`, clear: { productCategory: "" } });
  if (filters.source) chips.push({ label: `Kilde: ${PRODUCT_SOURCE_LABELS[filters.source]}`, clear: { source: "" } });
  if (filters.status) chips.push({ label: `Status: ${PRODUCT_STATUS_LABELS[filters.status]}`, clear: { status: "" } });
  if (filters.image) chips.push({ label: filters.image === "with" ? "Med billede" : "Uden billede", clear: { image: "" } });
  if (filters.barcode) chips.push({ label: filters.barcode === "with" ? "Med stregkode" : "Uden stregkode", clear: { barcode: "" } });

  return (
    <section
      aria-busy={pending}
      className="flex flex-col gap-4 rounded-lg border border-hf-tan-dark bg-hf-white p-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="hf-type-label text-text-secondary">Søg</span>
          <span className="hf-field flex items-center gap-2 rounded-md border border-hf-tan-dark bg-page-bg px-3 focus-within:border-hf-green">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Navn, mærke, sub brand, variant eller stregkode…"
              className="hf-type-body h-full w-full min-w-0 bg-transparent text-hf-black outline-none placeholder:text-text-muted"
            />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3 md:flex md:w-auto">
          <Field label="Sortér efter">
            <select
              value={filters.sort}
              onChange={(event) => go({ sort: event.target.value as Filters["sort"] })}
              className={`${fieldClass} md:w-52`}
            >
              {PRODUCT_DATABASE_SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Segment
            label="Visning"
            value={filters.view}
            options={[
              { value: "list", label: "Liste" },
              { value: "grid", label: "Galleri" },
            ]}
            onChange={(view) => go({ view, page: filters.page })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hf-tan-dark pt-3">
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
          className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Filtre
          {chips.length > 0 && (
            <span className="hf-type-micro hf-type-strong rounded-full bg-hf-green-dark px-1.5 text-hf-white">{chips.length}</span>
          )}
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {(chips.length > 0 || filters.q) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              lastPushedQuery.current = "";
              startTransition(() => {
                router.push(productDatabaseHref({ ...filters, q: "" }, {
                  store: "",
                  brand: "",
                  subbrand: "",
                  category: "",
                  productCategory: "",
                  source: "",
                  status: "",
                  image: "",
                  barcode: "",
                }), { scroll: false });
              });
            }}
            className="hf-btn-text text-hf-green-dark"
          >
            Nulstil alt
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Kæde">
            <select value={filters.store} onChange={(event) => go({ store: event.target.value })} className={fieldClass}>
              <option value="">Alle kæder</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.count.toLocaleString("da-DK")})
                </option>
              ))}
              <option value="none">Ikke tilknyttet en kæde</option>
            </select>
          </Field>
          <SuggestField
            id="product-database-brands"
            label="Mærke"
            placeholder="Alle mærker"
            value={filters.brand}
            suggestions={brands}
            onApply={(brand) => go({ brand, subbrand: "" })}
          />
          <SuggestField
            id="product-database-subbrands"
            label="Sub brand"
            placeholder={filters.brand ? `Alle under ${filters.brand}` : "Alle sub brands"}
            value={filters.subbrand}
            suggestions={subbrands}
            onApply={(subbrand) => go({ subbrand })}
          />
          <Field label="Kategori">
            <select value={filters.category} onChange={(event) => go({ category: event.target.value })} className={fieldClass}>
              <option value="">Alle kategorier</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value="none">Uden kategori</option>
            </select>
          </Field>
          <Field label="Varetype">
            <select
              value={filters.productCategory}
              onChange={(event) => go({ productCategory: event.target.value as Filters["productCategory"] })}
              className={fieldClass}
            >
              <option value="">Alle varetyper</option>
              {PRODUCT_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {PRODUCT_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kilde">
            <select value={filters.source} onChange={(event) => go({ source: event.target.value as Filters["source"] })} className={fieldClass}>
              <option value="">Alle kilder</option>
              {PRODUCT_SOURCES.map((key) => (
                <option key={key} value={key}>
                  {PRODUCT_SOURCE_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={(event) => go({ status: event.target.value as Filters["status"] })} className={fieldClass}>
              <option value="">Alle statusser</option>
              {PRODUCT_STATUSES.map((key) => (
                <option key={key} value={key}>
                  {PRODUCT_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Segment
              label="Billede"
              value={filters.image || "all"}
              options={[
                { value: "all", label: "Alle" },
                { value: "with", label: "Med" },
                { value: "without", label: "Uden" },
              ]}
              onChange={(image) => go({ image: image === "all" ? "" : image })}
            />
            <Segment
              label="Stregkode"
              value={filters.barcode || "all"}
              options={[
                { value: "all", label: "Alle" },
                { value: "with", label: "Med" },
                { value: "without", label: "Uden" },
              ]}
              onChange={(barcode) => go({ barcode: barcode === "all" ? "" : barcode })}
            />
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.label}>
              <button
                type="button"
                onClick={() => go(chip.clear)}
                className="hf-type-small flex items-center gap-1.5 rounded-full border border-hf-green bg-hf-tan px-3 py-1 text-hf-green-dark hover:bg-hf-tan-dark"
              >
                {chip.label}
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-label="Fjern filter">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
