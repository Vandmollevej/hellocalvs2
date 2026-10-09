"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DUPLICATE_FIELDS,
  formatFieldValue,
  isEmptyValue,
  sameValue,
  type DuplicateField,
  type DuplicateFieldValue,
  type DuplicateFieldValues,
} from "@/lib/duplicate-fields";
import type { CompareGroup } from "@/lib/duplicate-review";

// Én dublet-gruppe på admin "Dubletter" → Produkter (docs/DECISIONS.md
// 2026-09-28): op til 6 kolonner side om side. Kilde-kolonner har grå ramme;
// den endelige er lysegrå med grøn ramme. Ud for hvert felt, hvor en kilde
// har en værdi der ikke står i den endelige, peger en grøn pil mod den
// endelige kolonne (→ eller ←) — klik tager værdien over.

type Row = { type: "header" } | { type: "section"; label: string } | { type: "field"; field: DuplicateField };

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
      {direction === "right" ? (
        <path d="M3 10h13m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M17 10H4m5-5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ValueView({
  field,
  value,
  expanded,
}: {
  field: DuplicateField;
  value: DuplicateFieldValue | undefined;
  expanded: boolean;
}) {
  if (isEmptyValue(value)) return <span className="text-text-muted">—</span>;
  if (field.kind === "image" && typeof value === "string") {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="h-20 w-20 rounded-md bg-hf-white object-contain" />
      </a>
    );
  }
  const text = formatFieldValue(field, value);
  return (
    <span className={`break-words ${field.kind === "longtext" && !expanded ? "line-clamp-4" : ""}`} title={text}>
      {text}
    </span>
  );
}

export function DuplicateCompareGroup({ group }: { group: CompareGroup }) {
  const router = useRouter();
  const [finalId, setFinalId] = useState(group.finalColumnId);
  const finalColumn = group.columns.find((c) => c.id === finalId) ?? group.columns[group.columns.length - 1];
  const [values, setValues] = useState<DuplicateFieldValues>(() => ({ ...finalColumn.values }));
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"save" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const finalIndex = group.columns.findIndex((c) => c.id === finalColumn.id);

  // Felter, der er tomme i alle kolonner, vises ikke.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ type: "header" }];
    let section = "";
    for (const field of DUPLICATE_FIELDS) {
      const filled = group.columns.some((c) => !isEmptyValue(c.values[field.key]));
      if (!filled) continue;
      if (field.section !== section) {
        section = field.section;
        out.push({ type: "section", label: section });
      }
      out.push({ type: "field", field });
    }
    return out;
  }, [group.columns]);

  const changedKeys = DUPLICATE_FIELDS.filter(
    (f) => !f.readOnly && !sameValue(values[f.key], finalColumn.values[f.key]),
  ).map((f) => f.key);

  function chooseFinal(columnId: string) {
    const column = group.columns.find((c) => c.id === columnId);
    if (!column || !column.productId) return;
    setFinalId(columnId);
    setValues({ ...column.values });
  }

  function take(key: string, value: DuplicateFieldValue | undefined) {
    setValues((prev) => ({ ...prev, [key]: value ?? null }));
  }

  const productIds =
    group.kind === "sources"
      ? [finalColumn.productId as string]
      : group.columns.map((c) => c.productId).filter((id): id is string => !!id);

  async function submit(action: "save" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      const changed: DuplicateFieldValues = {};
      for (const key of changedKeys) changed[key] = values[key] ?? null;
      const res = await fetch("/api/admin/duplicate-products/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          kind: group.kind,
          productIds,
          keepProductId: finalColumn.productId,
          values: changed,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gemme");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (done) return null;

  const gridTemplateColumns = `7rem repeat(${group.columns.length}, minmax(9.5rem, 1fr))`;
  const gridTemplateRows = `repeat(${rows.length}, auto)`;
  const hasLongText = rows.some((r) => r.type === "field" && r.field.kind === "longtext");

  return (
    <section className="hf-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="hf-type-small text-text-secondary">
          {group.reason}
          {group.hiddenCount > 0 && ` · ${group.hiddenCount} mere vises efter denne fletning`}
        </p>
        {hasLongText && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="hf-type-small text-hf-green-dark">
            {expanded ? "Vis korte tekster" : "Vis hele tekster"}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="grid gap-x-2" style={{ gridTemplateColumns, gridTemplateRows }}>
          {/* Feltnavne */}
          <div className="grid grid-rows-subgrid" style={{ gridColumn: 1, gridRow: `1 / span ${rows.length}` }}>
            {rows.map((row, i) =>
              row.type === "field" ? (
                <div key={i} className="hf-type-small border-t border-hf-gray-border py-1.5 pr-2 text-text-secondary">
                  {row.field.label}
                </div>
              ) : row.type === "section" ? (
                <div key={i} className="hf-type-small hf-type-strong pb-1 pt-3 text-hf-black">
                  {row.label}
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>

          {group.columns.map((column, colIndex) => {
            const isFinal = column.id === finalColumn.id;
            const direction = colIndex < finalIndex ? "right" : "left";
            return (
              <div
                key={column.id}
                className={`grid grid-rows-subgrid rounded-lg px-2 pb-2 ${
                  isFinal ? "border-2 border-hf-green-dark bg-hf-gray-light" : "border border-hf-gray-border bg-hf-white"
                }`}
                style={{ gridColumn: colIndex + 2, gridRow: `1 / span ${rows.length}` }}
              >
                {rows.map((row, i) => {
                  if (row.type === "header") {
                    return (
                      <div key={i} className="flex flex-col gap-1 py-2">
                        <span className="hf-type-small hf-type-strong text-hf-black">
                          {isFinal ? "Endelig" : column.title}
                        </span>
                        <span className="hf-type-caption text-text-secondary">
                          {isFinal ? `${column.title} · ${column.subtitle}` : column.subtitle}
                        </span>
                        {!isFinal && column.productId && (
                          <button
                            type="button"
                            onClick={() => chooseFinal(column.id)}
                            className="hf-type-caption self-start text-hf-green-dark underline"
                          >
                            Gør til endelig
                          </button>
                        )}
                        {column.productId && (
                          <a
                            href={`/admin/products/${column.productId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hf-type-caption self-start text-text-secondary underline"
                          >
                            Åbn vare
                          </a>
                        )}
                      </div>
                    );
                  }
                  if (row.type === "section") return <div key={i} />;

                  const { field } = row;
                  if (isFinal) {
                    const changed = !field.readOnly && !sameValue(values[field.key], column.values[field.key]);
                    return (
                      <div key={i} className="hf-type-small flex flex-col gap-0.5 border-t border-hf-gray-border py-1.5 text-hf-black">
                        <ValueView field={field} value={field.readOnly ? column.values[field.key] : values[field.key]} expanded={expanded} />
                        {changed && (
                          <button
                            type="button"
                            onClick={() => take(field.key, column.values[field.key])}
                            className="hf-type-caption self-start text-text-secondary underline"
                          >
                            Fortryd
                          </button>
                        )}
                      </div>
                    );
                  }

                  const value = column.values[field.key];
                  const canTake =
                    !field.readOnly &&
                    !isEmptyValue(value) &&
                    !sameValue(value, values[field.key]) &&
                    !(field.required && isEmptyValue(value));
                  const arrow = canTake && (
                    <button
                      type="button"
                      onClick={() => take(field.key, value)}
                      aria-label={`Brug ${field.label} fra ${column.title}`}
                      title="Brug denne værdi i den endelige"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-hf-green-dark hover:bg-hf-green-light"
                    >
                      <Arrow direction={direction} />
                    </button>
                  );
                  return (
                    <div
                      key={i}
                      className="hf-type-small flex items-start gap-1 border-t border-hf-gray-border py-1.5 text-hf-black"
                    >
                      {direction === "left" && arrow}
                      <div className="min-w-0 flex-1">
                        <ValueView field={field} value={value} expanded={expanded} />
                      </div>
                      {direction === "right" && arrow}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="hf-type-caption text-text-secondary">
        {group.kind === "sources"
          ? "Butikkernes egne data til venstre. Den endelige er varen, som appen viser."
          : "De andre varer flettes ind i den endelige og slettes. Registreringer, favoritter, stregkoder og billeder flyttes med; tidligere registreringer beholder deres egne gemte værdier."}
      </p>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => submit("dismiss")}
          disabled={busy !== null}
          className="hf-type-small rounded-md border border-hf-gray-border px-3 py-1.5 text-text-secondary disabled:opacity-60"
        >
          {busy === "dismiss" ? "…" : group.kind === "sources" ? "Behold som nu" : "Ikke dubletter"}
        </button>
        <button
          type="button"
          onClick={() => submit("save")}
          disabled={busy !== null}
          className="hf-type-small hf-type-strong rounded-md bg-hf-green-dark px-4 py-1.5 text-hf-white disabled:opacity-60"
        >
          {busy === "save"
            ? "Gemmer…"
            : group.kind === "sources"
              ? `Gem endelig${changedKeys.length ? ` (${changedKeys.length} ændret)` : ""}`
              : "Flet til endelig"}
        </button>
      </div>
    </section>
  );
}
