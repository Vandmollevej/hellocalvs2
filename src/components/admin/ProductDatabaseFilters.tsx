"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
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
// Alle filtre er dropdowns; mærke, sub brand, kategori, varetype og kilde er
// flervalg.

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

const PRODUCT_CATEGORY_OPTIONS = PRODUCT_CATEGORIES.map((key) => ({ value: key, label: PRODUCT_CATEGORY_LABELS[key] }));
const SOURCE_OPTIONS = PRODUCT_SOURCES.map((key) => ({ value: key, label: PRODUCT_SOURCE_LABELS[key] }));
const STATUS_OPTIONS = PRODUCT_STATUSES.map((key) => ({ value: key, label: PRODUCT_STATUS_LABELS[key] }));
const SORT_OPTIONS = PRODUCT_DATABASE_SORTS.map((s) => ({ value: s.key, label: s.label }));
const IMAGE_OPTIONS = [
  { value: "with", label: "Med billede" },
  { value: "without", label: "Uden billede" },
];
const BARCODE_OPTIONS = [
  { value: "with", label: "Med stregkode" },
  { value: "without", label: "Uden stregkode" },
];

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

  const storeOptions = [
    ...stores.map((store) => ({ value: store.id, label: `${store.name} (${store.count.toLocaleString("da-DK")})` })),
    { value: "none", label: "Ikke tilknyttet en kæde" },
  ];
  const categoryOptions = [
    ...categories.map((category) => ({ value: category.id, label: category.name })),
    { value: "none", label: "Uden kategori" },
  ];
  const brandOptions = brands.map((brand) => ({ value: brand, label: brand }));
  const subbrandOptions = subbrands.map((subbrand) => ({ value: subbrand, label: subbrand }));

  // Én chip pr. valgt værdi, så de kan fjernes enkeltvis.
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];
  const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);
  if (filters.store) {
    const storeName = stores.find((s) => s.id === filters.store)?.name;
    chips.push({ key: "store", label: filters.store === "none" ? "Ingen kæde" : `Kæde: ${storeName ?? "ukendt"}`, clear: { store: "" } });
  }
  for (const brand of filters.brand) chips.push({ key: `brand:${brand}`, label: `Mærke: ${brand}`, clear: { brand: without(filters.brand, brand) } });
  for (const subbrand of filters.subbrand)
    chips.push({ key: `subbrand:${subbrand}`, label: `Sub brand: ${subbrand}`, clear: { subbrand: without(filters.subbrand, subbrand) } });
  for (const id of filters.category) {
    const name = categories.find((c) => c.id === id)?.name;
    chips.push({
      key: `category:${id}`,
      label: id === "none" ? "Uden kategori" : `Kategori: ${name ?? "ukendt"}`,
      clear: { category: without(filters.category, id) },
    });
  }
  for (const key of filters.productCategory)
    chips.push({
      key: `productCategory:${key}`,
      label: `Varetype: ${PRODUCT_CATEGORY_LABELS[key]}`,
      clear: { productCategory: without(filters.productCategory, key) },
    });
  for (const key of filters.source)
    chips.push({ key: `source:${key}`, label: `Kilde: ${PRODUCT_SOURCE_LABELS[key]}`, clear: { source: without(filters.source, key) } });
  if (filters.status) chips.push({ key: "status", label: `Status: ${PRODUCT_STATUS_LABELS[filters.status]}`, clear: { status: "" } });
  if (filters.image) chips.push({ key: "image", label: filters.image === "with" ? "Med billede" : "Uden billede", clear: { image: "" } });
  if (filters.barcode) chips.push({ key: "barcode", label: filters.barcode === "with" ? "Med stregkode" : "Uden stregkode", clear: { barcode: "" } });

  return (
    <section
      aria-busy={pending}
      className="flex flex-col gap-4 hf-surface p-4"
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
          <FilterDropdown
            label="Sortér efter"
            value={filters.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => go({ sort: sort as Filters["sort"] })}
            className="md:w-52"
          />
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
                  brand: [],
                  subbrand: [],
                  category: [],
                  productCategory: [],
                  source: [],
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
          <FilterDropdown
            label="Kæde"
            value={filters.store}
            allLabel="Alle kæder"
            options={storeOptions}
            onChange={(store) => go({ store })}
          />
          <FilterDropdown
            multiple
            label="Mærke"
            placeholder="Alle mærker"
            values={filters.brand}
            options={brandOptions}
            onChange={(brand) => go({ brand })}
          />
          <FilterDropdown
            multiple
            label="Sub brand"
            placeholder={filters.brand.length === 1 ? `Alle under ${filters.brand[0]}` : "Alle sub brands"}
            values={filters.subbrand}
            options={subbrandOptions}
            onChange={(subbrand) => go({ subbrand })}
          />
          <FilterDropdown
            multiple
            label="Kategori"
            placeholder="Alle kategorier"
            values={filters.category}
            options={categoryOptions}
            onChange={(category) => go({ category })}
          />
          <FilterDropdown
            multiple
            label="Varetype"
            placeholder="Alle varetyper"
            values={filters.productCategory}
            options={PRODUCT_CATEGORY_OPTIONS}
            onChange={(productCategory) => go({ productCategory: productCategory as Filters["productCategory"] })}
          />
          <FilterDropdown
            multiple
            label="Kilde"
            placeholder="Alle kilder"
            values={filters.source}
            options={SOURCE_OPTIONS}
            onChange={(source) => go({ source: source as Filters["source"] })}
          />
          <FilterDropdown
            label="Status"
            value={filters.status}
            allLabel="Alle statusser"
            options={STATUS_OPTIONS}
            onChange={(status) => go({ status: status as Filters["status"] })}
          />
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <FilterDropdown
              label="Billede"
              value={filters.image}
              allLabel="Alle"
              options={IMAGE_OPTIONS}
              onChange={(image) => go({ image: image as Filters["image"] })}
            />
            <FilterDropdown
              label="Stregkode"
              alignRight
              value={filters.barcode}
              allLabel="Alle"
              options={BARCODE_OPTIONS}
              onChange={(barcode) => go({ barcode: barcode as Filters["barcode"] })}
            />
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
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
