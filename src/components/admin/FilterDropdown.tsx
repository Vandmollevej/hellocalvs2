"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";

// Dropdown til admin-filtre: enkeltvalg (vælg én, lukker med det samme) eller
// flervalg (afkrydsning, forbliver åben). Lange lister får et søgefelt, og kun
// de første MAX_VISIBLE træffere vises, så fx 3.000 mærker ikke tynger siden.

export type FilterOption = { value: string; label: string };

const MAX_VISIBLE = 200;
const SEARCH_THRESHOLD = 10;

type CommonProps = {
  label: string;
  options: FilterOption[];
  className?: string;
  // Panelet flugter med højre kant (til dropdowns yderst til højre).
  alignRight?: boolean;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string;
  // Tekst for "ingen filtrering" (værdien ""); udelades den, er der altid en værdi valgt.
  allLabel?: string;
  onChange: (value: string) => void;
};

type MultiProps = CommonProps & {
  multiple: true;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
};

function CheckIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function FilterDropdown(props: SingleProps | MultiProps) {
  const { label, options, className = "", alignRight = false } = props;
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Flervalg vises optimistisk, mens dropdown'en er åben; når den lukkes,
  // følger den igen URL'en (fx efter "Nulstil alt" eller tilbage-knap).
  const propValues = props.multiple ? props.values : null;
  const [draft, setDraft] = useState<string[]>(propValues ?? []);
  const propKey = propValues ? propValues.join("\u0000") : "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger URL'en, når dropdown'en er lukket
    if (!open && propValues) setDraft(propValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- propKey dækker indholdet af propValues
  }, [open, propKey]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const labelByValue = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const searchable = options.length > SEARCH_THRESHOLD;
  const needle = search.trim().toLowerCase();
  const matches = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  let summary: string;
  let isPlaceholder = false;
  if (props.multiple) {
    if (draft.length === 0) {
      summary = props.placeholder;
      isPlaceholder = true;
    } else {
      const first = labelByValue.get(draft[0]) ?? draft[0];
      summary = draft.length === 1 ? first : `${first} +${draft.length - 1}`;
    }
  } else {
    summary = props.value === "" && props.allLabel ? props.allLabel : (labelByValue.get(props.value) ?? props.value);
  }

  // Flervalg: valgte værdier står øverst, også hvis de ikke findes i den
  // aktuelle liste (fx et sub brand uden for de valgte mærker).
  let rows: FilterOption[];
  if (props.multiple) {
    const selected = draft.map((value) => ({ value, label: labelByValue.get(value) ?? value }));
    const chosen = new Set(draft);
    rows = [...selected.filter((o) => !needle || o.label.toLowerCase().includes(needle)), ...matches.filter((o) => !chosen.has(o.value))];
  } else {
    rows = props.allLabel && !needle ? [{ value: "", label: props.allLabel }, ...matches] : matches;
  }
  const visible = rows.slice(0, MAX_VISIBLE);

  function toggleOpen() {
    setOpen((value) => !value);
    setSearch("");
  }

  function choose(value: string) {
    if (props.multiple) {
      const next = draft.includes(value) ? draft.filter((v) => v !== value) : [...draft, value];
      setDraft(next);
      props.onChange(next);
    } else {
      setOpen(false);
      if (value !== props.value) props.onChange(value);
    }
  }

  function clearAll() {
    if (!props.multiple) return;
    setDraft([]);
    props.onChange([]);
  }

  const active = props.multiple ? draft.length > 0 : props.value !== "" && Boolean(props.allLabel);

  return (
    <div ref={rootRef} className={`relative flex min-w-0 flex-col gap-1 ${className}`}>
      <span id={labelId} className="hf-type-label text-text-secondary">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={toggleOpen}
        className={`hf-type-body hf-field flex w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-hf-white px-3 text-left ${
          open || active ? "border-hf-green" : "border-hf-tan-dark"
        } ${isPlaceholder ? "text-text-muted" : "text-hf-black"}`}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <HfChevron direction={open ? "up" : "down"} compact className="shrink-0 text-hf-black" />
      </button>

      {open && (
        <div className={`absolute ${alignRight ? "right-0" : "left-0"} top-full z-30 mt-1 flex w-full min-w-64 flex-col overflow-hidden rounded-md border border-hf-tan-dark bg-hf-white shadow-lg`}>
          {searchable && (
            <div className="border-b border-hf-tan-dark p-2">
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Søg i ${label.toLowerCase()}…`}
                className="hf-type-body hf-field w-full min-w-0 rounded-md border border-hf-tan-dark bg-page-bg px-3 text-hf-black outline-none placeholder:text-text-muted focus:border-hf-green"
              />
            </div>
          )}
          <ul role="listbox" aria-labelledby={labelId} aria-multiselectable={props.multiple || undefined} className="max-h-72 overflow-y-auto py-1">
            {visible.length === 0 && <li className="hf-type-small px-3 py-2 text-text-muted">Ingen træffere</li>}
            {visible.map((option) => {
              const selected = props.multiple ? draft.includes(option.value) : option.value === props.value;
              return (
                <li key={option.value || "__all"} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => choose(option.value)}
                    className={`hf-type-body flex w-full items-center gap-3 px-3 py-2 text-left text-hf-black hover:bg-hf-tan ${
                      !props.multiple && selected ? "hf-type-strong" : ""
                    }`}
                  >
                    {props.multiple && (
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          selected ? "border-hf-black hf-selected" : "border-hf-tan-dark bg-hf-white"
                        }`}
                      >
                        {selected && <CheckIcon className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {!props.multiple && selected && <CheckIcon className="h-4 w-4 shrink-0 text-hf-green-dark" />}
                  </button>
                </li>
              );
            })}
            {rows.length > MAX_VISIBLE && (
              <li className="hf-type-small px-3 py-2 text-text-muted">
                Viser {MAX_VISIBLE} af {rows.length.toLocaleString("da-DK")} — søg for at indsnævre.
              </li>
            )}
          </ul>
          {props.multiple && (
            <div className="flex items-center justify-between gap-3 border-t border-hf-tan-dark px-3 py-2">
              <button type="button" onClick={clearAll} disabled={draft.length === 0} className="hf-btn-text text-hf-green-dark disabled:text-text-muted">
                Ryd
              </button>
              <button type="button" onClick={() => setOpen(false)} className="hf-btn-text text-hf-black">
                Færdig{draft.length > 0 ? ` (${draft.length})` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
