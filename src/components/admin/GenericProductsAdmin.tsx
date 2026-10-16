"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenericListFilters as Filters, GenericProductRow } from "@/lib/generic-product-admin";
import { ListModeToggle, ListPager, LoadMoreSentinel, useListMode } from "@/components/admin/ListMode";

// Admin → Varer → Generiske produkter (docs/DECISIONS.md 2026-10-15).
// Formular (opret/redigér), drag-and-drop-import med forhåndsvisning og
// listen med redigér/slet. Logikken ligger i src/lib/generic-product-admin.ts.

type FormState = {
  sheetCategory: string;
  productType: string;
  variation: string;
  keywords: string;
  properties: string;
  nameSingular: string;
  namePlural: string;
  sourceKind: "FRIDA" | "OTHER";
  foodId: string;
  fridaName: string;
  fridaKcal: number | null;
  sourceName: string;
  sourceUrl: string;
};

const EMPTY_FORM: FormState = {
  sheetCategory: "",
  productType: "",
  variation: "",
  keywords: "",
  properties: "",
  nameSingular: "",
  namePlural: "",
  sourceKind: "FRIDA",
  foodId: "",
  fridaName: "",
  fridaKcal: null,
  sourceName: "",
  sourceUrl: "",
};

const numberFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const num = (value: number | null) => (value === null ? "–" : numberFormat.format(value));

function formFromRow(row: GenericProductRow): FormState {
  return {
    sheetCategory: row.sheetCategory,
    productType: row.productType,
    variation: row.variation,
    keywords: row.keywords.join(", "),
    properties: row.properties.join(", "),
    nameSingular: row.nameSingular,
    namePlural: row.namePlural,
    sourceKind: row.sourceKind === "OTHER" ? "OTHER" : "FRIDA",
    foodId: row.fridaFoodId,
    fridaName: row.fridaName,
    fridaKcal: row.kcalPer100g,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
  };
}

function Field({
  label,
  help,
  required,
  children,
}: {
  label: string;
  help: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="hf-form-label">
      <span className="hf-type-label text-hf-black">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      <span className="hf-type-caption text-text-muted">{help}</span>
    </label>
  );
}

function GenericProductForm({
  editing,
  categories,
  onDone,
}: {
  editing: GenericProductRow | null;
  categories: string[];
  onDone: (saved: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(editing ? formFromRow(editing) : EMPTY_FORM);
  const [fridaQuery, setFridaQuery] = useState("");
  const [fridaResults, setFridaResults] = useState<{ externalId: string | null; name: string; kcalPer100g: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  async function lookupFrida(query: string) {
    if (!query.trim()) return;
    const res = await fetch(`/api/admin/generic-ingredients/frida?q=${encodeURIComponent(query.trim())}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setFridaResults(data?.results ?? []);
    if (!data?.results?.length) setError(`Ingen Frida-vare fundet for "${query.trim()}"`);
    else setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      sheetCategory: form.sheetCategory,
      productType: form.productType,
      variation: form.variation,
      keywords: form.keywords,
      properties: form.properties,
      nameSingular: form.nameSingular,
      namePlural: form.namePlural,
      source:
        form.sourceKind === "FRIDA"
          ? { kind: "FRIDA", foodId: form.foodId }
          : { kind: "OTHER", name: form.sourceName, url: form.sourceUrl },
    };
    const res = await fetch(
      editing ? `/api/admin/generic-ingredients/${encodeURIComponent(editing.id)}` : "/api/admin/generic-ingredients",
      { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    ).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.message ?? "Kunne ikke gemme");
      return;
    }
    onDone(true);
  }

  const fridaChosen = form.sourceKind === "FRIDA" && form.foodId && form.fridaName;

  return (
    <section className="hf-panel hf-panel--form" aria-label={editing ? "Redigér generisk produkt" : "Opret generisk produkt"}>
      <h2 className="hf-type-section-title text-hf-black">
        {editing ? `Redigér: ${editing.nameSingular}` : "Opret generisk produkt"}
      </h2>
      <p className="hf-type-body text-text-secondary">Felter med * skal udfyldes. Kolonnerne er de samme som i arket.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Kategori" required help="Fødevaregruppen fra arket. Fx: Kernefrugt, Oksekød, Brød.">
          <input
            className="hf-input"
            list="generic-categories"
            value={form.sheetCategory}
            onChange={(e) => set("sheetCategory", e.target.value)}
          />
          <datalist id="generic-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Produkttype" required help="Selve varen uden detaljer. Fx: Æble, Hakket oksekød, Rugbrød.">
          <input className="hf-input" value={form.productType} onChange={(e) => set("productType", e.target.value)} />
        </Field>
        <Field label="Variation" help="Det, der adskiller den fra andre af samme type. Fx: med skræl, 8-12% fedt, kerner. Kan være tomt.">
          <input className="hf-input" value={form.variation} onChange={(e) => set("variation", e.target.value)} />
        </Field>
        <Field label="Nøgleord" help="Ekstra søgeord, adskilt med komma. Fx: pink lady, rødt æble. Kan være tomt.">
          <input className="hf-input" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
        </Field>
        <Field
          label="Egenskaber"
          help="Tilstand og kendetegn, adskilt med komma. Fx: rå, frost, kogt, stegt, 10%, vegansk. Kogt/stegt/bagt gør varen tilberedt."
        >
          <input className="hf-input" value={form.properties} onChange={(e) => set("properties", e.target.value)} />
        </Field>
        <div />
        <Field label="Titel (ental)" required help='Navnet på én. Fx: Æble med skræl (Rå). Bruges ved "et æble".'>
          <input className="hf-input" value={form.nameSingular} onChange={(e) => set("nameSingular", e.target.value)} />
        </Field>
        <Field label="Titel (flertal)" required help='Navnet på flere. Fx: Æbler med skræl (Rå). Er den ens, skriv det samme som ental.'>
          <input className="hf-input" value={form.namePlural} onChange={(e) => set("namePlural", e.target.value)} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="hf-type-label text-hf-black">Kilde *</legend>
        <p className="hf-type-caption text-text-muted">
          Hvor næringstallene kommer fra. Frida kopierer kcal, protein, kulhydrat, fedt og mikronæring fra Frida-varen.
          Anden kilde giver tomme næringstal (–), aldrig et skøn.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="hf-type-body flex items-center gap-2">
            <input
              type="radio"
              className="hf-native-choice"
              checked={form.sourceKind === "FRIDA"}
              onChange={() => set("sourceKind", "FRIDA")}
            />
            Frida (FoodID)
          </label>
          <label className="hf-type-body flex items-center gap-2">
            <input
              type="radio"
              className="hf-native-choice"
              checked={form.sourceKind === "OTHER"}
              onChange={() => set("sourceKind", "OTHER")}
            />
            Anden kilde
          </label>
        </div>

        {form.sourceKind === "FRIDA" ? (
          <div className="flex flex-col gap-2">
            <Field label="Find Frida-vare" help="Skriv FoodID (fx 101) eller en del af Frida-navnet (fx æble, rå) og tryk Søg.">
              <div className="flex gap-2">
                <input
                  className="hf-input flex-1"
                  value={fridaQuery}
                  onChange={(e) => setFridaQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupFrida(fridaQuery);
                    }
                  }}
                />
                <button type="button" className="hf-btn-secondary hf-btn--compact hf-btn--inline" onClick={() => lookupFrida(fridaQuery)}>
                  Søg
                </button>
              </div>
            </Field>
            {fridaResults.length > 0 && (
              <ul className="hf-surface flex flex-col p-1">
                {fridaResults.map((r) => (
                  <li key={r.externalId ?? r.name}>
                    <button
                      type="button"
                      className="hf-btn-text hf-btn--inline w-full justify-start"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, foodId: r.externalId ?? "", fridaName: r.name, fridaKcal: r.kcalPer100g }));
                        setFridaResults([]);
                      }}
                    >
                      {r.externalId} · {r.name} · {num(r.kcalPer100g)} kcal
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="hf-type-body text-hf-black">
              {fridaChosen ? (
                <>
                  Valgt: <span className="hf-type-strong">FoodID {form.foodId}</span> — {form.fridaName} ({num(form.fridaKcal)} kcal/100 g)
                </>
              ) : (
                <span className="text-text-muted">Ingen Frida-vare valgt endnu.</span>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Kildens navn" required help="Hvor oplysningerne er fra. Fx: Producentens hjemmeside, Fødevarestyrelsen.">
              <input className="hf-input" value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} />
            </Field>
            <Field label="Kilde-URL" required help="Link til kilden. Fx: https://www.producent.dk/produkt/aeble">
              <input className="hf-input" type="url" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
            </Field>
          </div>
        )}
      </fieldset>

      {editing && editing.registrations > 0 && (
        <p className="hf-type-caption text-text-muted">
          Bruges i {editing.registrations} registreringer. De har deres egne gemte tal og ændres ikke af en rettelse her.
        </p>
      )}
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="hf-btn-brand hf-btn--compact hf-btn--inline" disabled={busy} onClick={save}>
          {editing ? "Gem ændringer" : "Opret"}
        </button>
        <button type="button" className="hf-btn-secondary hf-btn--compact hf-btn--inline" disabled={busy} onClick={() => onDone(false)}>
          Annullér
        </button>
      </div>
    </section>
  );
}

type PreviewRow = {
  line: number;
  input: { sheetCategory: string; productType: string; nameSingular: string; namePlural: string; source: { kind: string; foodId?: string; name?: string } };
  fridaName: string | null;
  kcalPer100g: number | null;
  errors: string[];
};

function GenericImport({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(chosen: File, mode: "preview" | "commit") {
    setBusy(true);
    setError(null);
    setMessage(null);
    const body = new FormData();
    body.set("file", chosen);
    body.set("mode", mode);
    const res = await fetch("/api/admin/generic-ingredients/import", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(data?.message ?? "Filen kunne ikke læses");
      return;
    }
    if (mode === "preview") {
      if (data.missingColumns?.length) {
        setRows(null);
        setError(`Filen mangler kolonnerne: ${data.missingColumns.join(", ")}`);
        return;
      }
      setRows(data.rows);
      setOnlyErrors(data.rows.some((r: PreviewRow) => r.errors.length > 0));
      return;
    }
    setRows(null);
    setFile(null);
    setMessage(`${data.created} generiske produkter oprettet${data.skipped ? `, ${data.skipped} rækker med fejl sprunget over` : ""}.`);
    onImported();
  }

  function choose(chosen: File | undefined) {
    if (!chosen) return;
    setFile(chosen);
    void send(chosen, "preview");
  }

  const valid = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const invalid = (rows?.length ?? 0) - valid;
  const shown = rows ? (onlyErrors ? rows.filter((r) => r.errors.length > 0) : rows) : [];

  return (
    <section className="hf-panel hf-panel--form" aria-label="Importér generiske produkter">
      <h2 className="hf-type-section-title text-hf-black">Importér fra CSV eller Excel</h2>
      <p className="hf-type-body text-text-secondary">
        Kolonner som i arket Generiske produkter.xlsx: Kategori, Produkttype, Variation, Nøgleord, Egenskaber, Titel (ental),
        Titel (flertal), Frida FoodID. Rækker uden Frida FoodID skal have kolonnerne Kilde og Kilde-URL. Du ser alle fejl, før
        noget bliver oprettet.
      </p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
        className={`hf-surface flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 border-dashed p-4 text-center ${
          dragging ? "bg-hf-green-light" : ""
        }`}
      >
        <span className="hf-type-body hf-type-strong text-hf-black">
          {busy ? "Læser filen …" : file ? file.name : "Træk en .xlsx- eller .csv-fil hertil"}
        </span>
        <span className="hf-type-caption text-text-muted">eller klik for at vælge en fil</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hf-native-file hidden"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      {message && <p className="hf-type-body text-hf-green-dark">{message}</p>}

      {rows && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="hf-badge hf-badge--success">{valid} klar</span>
            {invalid > 0 && <span className="hf-badge hf-badge--danger">{invalid} med fejl (springes over)</span>}
            <label className="hf-type-body flex items-center gap-2">
              <input type="checkbox" className="hf-native-choice" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
              Vis kun rækker med fejl
            </label>
          </div>
          <div className="hf-table-scroll max-h-[28rem] overflow-y-auto">
            <table className="hf-type-body w-full text-left">
              <thead>
                <tr className="hf-table-section hf-type-small">
                  <th className="py-2 pr-3">Række</th>
                  <th className="py-2 pr-3">Titel (ental / flertal)</th>
                  <th className="py-2 pr-3">Kategori · type</th>
                  <th className="py-2 pr-3">Kilde</th>
                  <th className="py-2 pr-3">kcal</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 500).map((r) => (
                  <tr key={r.line} className="border-b border-border-strong/50 align-top">
                    <td className="py-2 pr-3">{r.line}</td>
                    <td className="py-2 pr-3">
                      <div className="hf-type-strong">{r.input.nameSingular || "–"}</div>
                      <div className="hf-type-caption">{r.input.namePlural || "–"}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {r.input.sheetCategory || "–"} · {r.input.productType || "–"}
                    </td>
                    <td className="py-2 pr-3">
                      {r.input.source.kind === "FRIDA"
                        ? `Frida ${r.input.source.foodId}${r.fridaName ? ` — ${r.fridaName}` : ""}`
                        : r.input.source.name || "–"}
                    </td>
                    <td className="py-2 pr-3">{num(r.kcalPer100g)}</td>
                    <td className="py-2">
                      {r.errors.length === 0 ? (
                        <span className="hf-badge hf-badge--success">OK</span>
                      ) : (
                        <ul className="hf-type-caption text-hf-red-dark">
                          {r.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && <p className="hf-type-caption text-text-muted">Viser de første 500 af {shown.length} rækker.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="hf-btn-brand hf-btn--compact hf-btn--inline"
              disabled={busy || valid === 0 || !file}
              onClick={() => file && send(file, "commit")}
            >
              Opret {valid} generiske produkter
            </button>
            <button
              type="button"
              className="hf-btn-secondary hf-btn--compact hf-btn--inline"
              disabled={busy}
              onClick={() => {
                setRows(null);
                setFile(null);
              }}
            >
              Annullér
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function sourceText(row: GenericProductRow) {
  if (row.sourceKind === "FRIDA") return `Frida ${row.fridaFoodId} — ${row.fridaName}`;
  if (row.sourceKind === "OTHER") return row.sourceName;
  return "Ingen kilde";
}

// Samme som LIST_PAGE_SIZE i src/lib/generic-product-admin.ts (serverfil).
const PAGE_SIZE = 100;

type ListPage = { rows: GenericProductRow[]; matching: number; pages: number };

export function GenericProductsAdmin({
  initial,
  categories,
  filters,
}: {
  initial: ListPage;
  categories: string[];
  filters: Filters;
}) {
  const router = useRouter();
  const [listMode] = useListMode();
  const [rows, setRows] = useState(initial.rows);
  const [matching, setMatching] = useState(initial.matching);
  const [pages, setPages] = useState(initial.pages);
  const [page, setPage] = useState(1);
  // Hvilken side rows[0] hører til (evigheds-scroll lægger sider i forlængelse).
  const [firstPage, setFirstPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Henter et udsnit; append = evigheds-scroll, ellers erstattes listen.
  async function load(nextPage: number, append: boolean) {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ ...filters, page: String(nextPage) });
    const res = await fetch(`/api/admin/generic-ingredients?${params}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as ListPage | null;
    setLoading(false);
    if (!res?.ok || !data) {
      setLoadError("Kunne ikke hente flere");
      return;
    }
    setRows((prev) => (append ? [...prev, ...data.rows] : data.rows));
    if (!append) setFirstPage(nextPage);
    setMatching(data.matching);
    setPages(data.pages);
    setPage(nextPage);
  }

  function reload() {
    router.refresh();
    void load(1, false);
  }
  const [mode, setMode] = useState<"none" | "create" | "import" | { edit: GenericProductRow }>("none");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(row: GenericProductRow) {
    const text =
      row.registrations > 0
        ? `"${row.nameSingular}" bruges i ${row.registrations} registreringer.\n\nDen skjules fra søgningen og flyttes til "Slettede, men brugt". Registreringerne bevares uændret.\n\nFortsæt?`
        : `Slet "${row.nameSingular}" for altid?`;
    if (!window.confirm(text)) return;
    await change(row, { method: "DELETE" });
  }

  async function change(row: GenericProductRow, init: RequestInit) {
    setBusyId(row.id);
    setError(null);
    const res = await fetch(`/api/admin/generic-ingredients/${encodeURIComponent(row.id)}`, init).catch(() => null);
    setBusyId(null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.message ?? "Kunne ikke gemme");
      return;
    }
    reload();
  }

  const start = (page - firstPage) * PAGE_SIZE;
  const visible = listMode === "pages" ? rows.slice(start, start + PAGE_SIZE) : rows;

  const editing = typeof mode === "object" ? mode.edit : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="hf-btn-brand hf-btn--compact hf-btn--inline" onClick={() => setMode("create")}>
          Opret generisk produkt
        </button>
        <button type="button" className="hf-btn-secondary hf-btn--compact hf-btn--inline" onClick={() => setMode(mode === "import" ? "none" : "import")}>
          Importér CSV/Excel
        </button>
      </div>

      {(mode === "create" || editing) && (
        <GenericProductForm key={editing?.id ?? "new"} editing={editing} categories={categories} onDone={(saved) => {
            setMode("none");
            if (saved) reload();
          }} />
      )}
      {mode === "import" && <GenericImport onImported={reload} />}

      <form action="/admin/product-database/generics" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <label className="hf-form-label flex-1">
          <span className="hf-type-label">Søg</span>
          <input name="q" defaultValue={filters.q} placeholder="Titel, produkttype, variation eller nøgleord" className="hf-input hf-input--compact" />
        </label>
        <label className="hf-form-label">
          <span className="hf-type-label">Kategori</span>
          <select name="category" defaultValue={filters.category} className="hf-input hf-input--compact">
            <option value="">Alle kategorier</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="hf-form-label">
          <span className="hf-type-label">Kilde</span>
          <select name="source" defaultValue={filters.source} className="hf-input hf-input--compact">
            <option value="">Alle kilder</option>
            <option value="frida">Frida</option>
            <option value="other">Anden kilde</option>
            <option value="none">Ingen kilde</option>
          </select>
        </label>
        <button type="submit" className="hf-btn-secondary hf-btn--compact hf-btn--inline">
          Søg
        </button>
      </form>

      <ListModeToggle summary={`Viser ${numberFormat.format(visible.length)} af ${numberFormat.format(matching)}`} />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}

      {rows.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen generiske produkter matcher.</p>
      ) : (
        <div className="hf-table-scroll">
          <table className="hf-type-body w-full text-left">
            <thead>
              <tr className="hf-table-section hf-type-small">
                <th className="py-2 pr-3">Titel (ental / flertal)</th>
                <th className="py-2 pr-3">Kategori · type · variation</th>
                <th className="py-2 pr-3">Egenskaber</th>
                <th className="py-2 pr-3">Kilde</th>
                <th className="py-2 pr-3">kcal / P / K / F</th>
                <th className="py-2 pr-3">Brugt</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-border-strong/50 align-top">
                  <td className="py-2 pr-3">
                    <div className="hf-type-strong">{row.nameSingular}</div>
                    <div className="hf-type-caption">{row.namePlural}</div>
                  </td>
                  <td className="py-2 pr-3">
                    {[row.sheetCategory || "–", row.productType || "–", row.variation].filter(Boolean).join(" · ")}
                  </td>
                  <td className="py-2 pr-3">{row.properties.join(", ") || "–"}</td>
                  <td className="py-2 pr-3">
                    {row.sourceKind === "OTHER" && row.sourceUrl ? (
                      <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-hf-green-dark underline">
                        {sourceText(row)}
                      </a>
                    ) : row.sourceKind === null ? (
                      <span className="hf-badge hf-badge--warning">{sourceText(row)}</span>
                    ) : (
                      sourceText(row)
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {num(row.kcalPer100g)} / {num(row.proteinPer100g)} / {num(row.carbsPer100g)} / {num(row.fatPer100g)}
                  </td>
                  <td className="py-2 pr-3">{row.registrations}</td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      {row.archived ? (
                        <button
                          type="button"
                          className="hf-btn-secondary hf-btn--compact hf-btn--inline"
                          disabled={busyId === row.id}
                          onClick={() =>
                            change(row, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "restore" }),
                            })
                          }
                        >
                          Gendan
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="hf-btn-secondary hf-btn--compact hf-btn--inline"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setMode({ edit: row });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Redigér
                          </button>
                          <button
                            type="button"
                            className="hf-btn-danger hf-btn--compact hf-btn--inline"
                            disabled={busyId === row.id}
                            onClick={() => remove(row)}
                          >
                            Slet
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {listMode === "scroll" && rows.length < matching && (
        <LoadMoreSentinel onVisible={() => void load(page + 1, true)} loading={loading} error={loadError} />
      )}
      {listMode === "pages" && <ListPager page={page} pages={pages} onPage={(next) => void load(next, false)} busy={loading} />}
    </>
  );
}
