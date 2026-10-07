"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlowPagePreview, PhonePreviewEditor } from "@/components/admin/PhonePreviewEditor";
import { HfChevron } from "@/components/hf/HfChevron";

type FlowPage = { id?: string; title: string; bodyHtml: string; buttonLabel: string; actionLabel: string; actionHref: string };
type Conditions = {
  startDate?: string;
  endDate?: string;
  pages?: string[];
  minLogins?: number;
  maxLogins?: number;
  minDaysSinceSignup?: number;
  maxDaysSinceSignup?: number;
  minActiveDays?: number;
  visited?: string[];
  notVisited?: string[];
  minDaysBetweenShows?: number;
  weekdays?: number[];
  fromHour?: number;
  toHour?: number;
};
type Flow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  kind: "popup" | "banner";
  conditions: Conditions;
  priority: number;
  maxShows: number;
  pages: FlowPage[];
};
type SavedPage = Omit<FlowPage, "actionLabel" | "actionHref"> & { actionLabel: string | null; actionHref: string | null };

// Betingelsesfelterne i editoren (src/lib/flow-conditions.ts). Lister skrives
// kommasepareret, tal som hele tal; tomt felt = ingen grænse.
const NUMBER_CONDITIONS: { key: keyof Conditions; label: string }[] = [
  { key: "minLogins", label: "Mindst antal log-ins" },
  { key: "maxLogins", label: "Højst antal log-ins" },
  { key: "minDaysSinceSignup", label: "Mindst dage siden oprettelse" },
  { key: "maxDaysSinceSignup", label: "Højst dage siden oprettelse" },
  { key: "minActiveDays", label: "Mindst dage med indtastninger" },
  { key: "minDaysBetweenShows", label: "Dage mellem visninger" },
  { key: "fromHour", label: "Vis fra klokken (0-23)" },
  { key: "toHour", label: "Vis til klokken (0-24)" },
];
const LIST_CONDITIONS: { key: "pages" | "visited" | "notVisited"; label: string; hint: string }[] = [
  { key: "pages", label: "Kun på disse sider", hint: "Fx /calendar, /statistics. Tomt = alle sider." },
  { key: "visited", label: "Har besøgt fanerne", hint: "Fx /statistics. Alle skal være besøgt." },
  { key: "notVisited", label: "Har IKKE besøgt fanerne", hint: "Fx /camera = har ikke brugt mad-scanningen." },
];
const WEEKDAYS = [
  { value: 1, label: "Man" },
  { value: 2, label: "Tir" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lør" },
  { value: 0, label: "Søn" },
];
type EditablePage =FlowPage & { key: string };

// Felter og kort følger design.md §6.4/§6.6: 48 px høje felter, radius 8,
// 1 px kant, 17 px inputtekst og 13 px label over feltet.
const fieldClass = "hf-field w-full rounded-lg border border-hf-gray-border bg-hf-white px-4 hf-type-input text-hf-black";
const textareaClass = "w-full rounded-lg border border-hf-gray-border bg-hf-white px-4 py-3 hf-type-small font-mono text-hf-black";
const labelClass = "flex flex-col gap-1 hf-type-label text-text-secondary";
const cardClass = "flex flex-col gap-4 hf-surface p-4";

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" />
    </svg>
  );
}

let nextKey = 0;
function withKey(page: FlowPage): EditablePage {
  nextKey += 1;
  return { ...page, key: page.id ?? `new-${nextKey}` };
}

// Opret et nyt flow og gå direkte til editoren.
export function NewFlowForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok || !data?.id) {
        setError(data?.message ?? "Kunne ikke oprette flowet.");
        return;
      }
      router.push(`/admin/flows/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) void create();
      }}
      className="sm:flex-row sm:items-center hf-panel"
    >
      <input
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        placeholder="Navn på nyt flow, fx 'Velkomst'"
        className={`min-w-0 flex-1 ${fieldClass}`}
        aria-label="Navn på nyt flow"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="hf-btn-primary h-12 w-full shrink-0 px-4 sm:w-auto"
      >
        Opret flow
      </button>
      {error && <p className="hf-type-body text-hf-red-dark sm:basis-full">{error}</p>}
    </form>
  );
}

// Flow-editoren: telefonen til venstre viser den valgte side, til højre
// redigeres flowet og dets sider. Alt gemmes samlet med "Gem".
export function FlowEditor({ flow }: { flow: Flow }) {
  const router = useRouter();
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description);
  const [enabled, setEnabled] = useState(flow.enabled);
  const [kind, setKind] = useState(flow.kind);
  const [conditions, setConditions] = useState<Conditions>(flow.conditions);
  const [priority, setPriority] = useState(String(flow.priority));
  const [maxShows, setMaxShows] = useState(String(flow.maxShows));
  const [pages, setPages] = useState<EditablePage[]>(() => flow.pages.map(withKey));
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const current = pages[Math.min(selected, pages.length - 1)];
  const currentIndex = current ? pages.indexOf(current) : -1;

  function touch() {
    setDirty(true);
    setMessage(null);
  }

  function updatePage(patch: Partial<FlowPage>) {
    if (!current) return;
    setPages((list) => list.map((page) => (page.key === current.key ? { ...page, ...patch } : page)));
    touch();
  }

  function setCondition(patch: Partial<Conditions>) {
    setConditions((value) => ({ ...value, ...patch }));
    touch();
  }

  function addPage() {
    setPages((list) => [...list, withKey({ title: "", bodyHtml: "", buttonLabel: "Næste", actionLabel: "", actionHref: "" })]);
    setSelected(pages.length);
    touch();
  }

  function removePage(index: number) {
    if (!window.confirm(`Slet side ${index + 1}?`)) return;
    setPages((list) => list.filter((_, i) => i !== index));
    setSelected((value) => Math.max(0, value > index ? value - 1 : Math.min(value, pages.length - 2)));
    touch();
  }

  function movePage(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((list) => {
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelected(target);
    touch();
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          enabled,
          kind,
          conditions,
          priority: Number(priority) || 0,
          maxShows: Number(maxShows) || 0,
          pages: pages.map(({ id, title, bodyHtml, buttonLabel, actionLabel, actionHref }) => ({
            id,
            title,
            bodyHtml,
            buttonLabel,
            actionLabel,
            actionHref,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as { flow?: { pages: SavedPage[] }; message?: string } | null;
      if (!res.ok || !data?.flow) {
        setMessage(data?.message ?? "Kunne ikke gemme.");
        return;
      }
      // Nye sider har fået id'er — læs dem ind, så næste gem opdaterer.
      setPages(
        data.flow.pages.map((page) => withKey({ ...page, actionLabel: page.actionLabel ?? "", actionHref: page.actionHref ?? "" })),
      );
      setDirty(false);
      setMessage("Gemt ✓");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Slet flowet "${flow.name}" og alle dets sider?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/flows");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhonePreviewEditor
      preview={
        current ? (
          <FlowPagePreview
            title={current.title}
            html={current.bodyHtml}
            buttonLabel={current.buttonLabel}
            step={currentIndex}
            total={pages.length}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-hf-cream hf-type-body text-text-muted">Ingen sider</div>
        )
      }
    >
      <div className={cardClass}>
        <label className={labelClass}>
          Navn
          <input
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Beskrivelse (kun til admin)
          <input
            value={description}
            maxLength={500}
            onChange={(event) => {
              setDescription(event.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="hf-type-label text-text-secondary">Status</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Status">
            {[
              { value: true, label: "Aktiv" },
              { value: false, label: "Kladde" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={enabled === option.value}
                onClick={() => {
                  if (enabled === option.value) return;
                  setEnabled(option.value);
                  touch();
                }}
                className="hf-choice flex-1 sm:flex-none sm:px-6"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <p className="hf-type-title text-hf-black">Visning og betingelser</p>
        <div className="flex flex-col gap-1">
          <span className="hf-type-label text-text-secondary">Vises som</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Vises som">
            {[
              { value: "popup" as const, label: "Popup (alle sider)" },
              { value: "banner" as const, label: "Banner med hint (første side)" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => {
                  if (kind === option.value) return;
                  setKind(option.value);
                  touch();
                }}
                className="hf-choice flex-1 sm:flex-none sm:px-6"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Vis fra dato
            <input
              type="date"
              value={conditions.startDate ?? ""}
              onChange={(event) => setCondition({ startDate: event.target.value || undefined })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Vis til og med dato
            <input
              type="date"
              value={conditions.endDate ?? ""}
              onChange={(event) => setCondition({ endDate: event.target.value || undefined })}
              className={fieldClass}
            />
          </label>
          {NUMBER_CONDITIONS.map(({ key, label }) => (
            <label key={key} className={labelClass}>
              {label}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={(conditions[key] as number | undefined) ?? ""}
                onChange={(event) =>
                  setCondition({
                    [key]: event.target.value === "" ? undefined : Math.max(0, Math.floor(Number(event.target.value))),
                  })
                }
                className={fieldClass}
              />
            </label>
          ))}
          <label className={labelClass}>
            Højst antal visninger pr. bruger (0 = uden grænse)
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={maxShows}
              onChange={(event) => {
                setMaxShows(event.target.value);
                touch();
              }}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Prioritet (højeste vises først)
            <input
              type="number"
              inputMode="numeric"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                touch();
              }}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="hf-type-label text-text-secondary">Kun disse ugedage (ingen valgt = alle dage)</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ugedage">
            {WEEKDAYS.map((day) => {
              const on = conditions.weekdays?.includes(day.value) ?? false;
              return (
                <button
                  key={day.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => {
                    const current = conditions.weekdays ?? [];
                    const next = on ? current.filter((d) => d !== day.value) : [...current, day.value].sort();
                    setCondition({ weekdays: next.length ? next : undefined });
                  }}
                  className={`hf-choice px-4 ${on ? "border-[1.5px] border-hf-black bg-hf-tan" : ""}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
        {LIST_CONDITIONS.map(({ key, label, hint }) => (
          <label key={key} className={labelClass}>
            {label}
            <input
              defaultValue={(conditions[key] ?? []).join(", ")}
              onChange={(event) => {
                const list = event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean);
                setCondition({ [key]: list.length ? list : undefined });
              }}
              placeholder={hint}
              className={fieldClass}
            />
          </label>
        ))}
        <p className="hf-type-small text-text-muted">
          Alle udfyldte betingelser skal passe. Tomme felter = ingen grænse. Brugeren kan slå popups og bannere fra under
          Indstillinger → Visning → Tips.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="hf-type-title text-hf-black">Sider</p>
        <ol className="flex flex-col gap-2">
          {pages.map((page, index) => (
            <li
              key={page.key}
              className={`hf-control-row flex items-center gap-1 rounded-lg pl-4 pr-1 ${
                index === currentIndex
                  ? "border-[1.5px] border-hf-black bg-hf-tan"
                  : "border border-hf-tan-dark bg-hf-white"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-current={index === currentIndex ? "step" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 text-left text-hf-black ${
                  index === currentIndex ? "hf-type-body hf-type-strong" : "hf-type-body"
                }`}
              >
                <span className="shrink-0 tabular-nums text-text-secondary">{index + 1}</span>
                <span className="truncate">{page.title || "(uden titel)"}</span>
              </button>
              <button
                type="button"
                onClick={() => movePage(index, -1)}
                disabled={index === 0}
                aria-label="Flyt op"
                className="hf-btn-icon text-hf-black hover:bg-hf-tan"
              >
                <HfChevron direction="up" compact />
              </button>
              <button
                type="button"
                onClick={() => movePage(index, 1)}
                disabled={index === pages.length - 1}
                aria-label="Flyt ned"
                className="hf-btn-icon text-hf-black hover:bg-hf-tan"
              >
                <HfChevron direction="down" compact />
              </button>
              <button
                type="button"
                onClick={() => removePage(index)}
                aria-label="Slet side"
                className="hf-btn-icon text-hf-red-dark hover:bg-hf-tan"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={addPage}
          className="hf-btn-secondary h-12 w-full px-4 sm:w-fit"
        >
          <PlusIcon />
          Tilføj side
        </button>
      </div>

      {current && (
        <div className={cardClass}>
          <p className="hf-type-title text-hf-black">Side {currentIndex + 1}</p>
          <label className={labelClass}>
            Overskrift
            <input
              value={current.title}
              maxLength={200}
              onChange={(event) => updatePage({ title: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Indhold (tekst eller HTML)
            <textarea
              rows={14}
              value={current.bodyHtml}
              onChange={(event) => updatePage({ bodyHtml: event.target.value })}
              className={textareaClass}
            />
          </label>
          <label className={labelClass}>
            Tekst på knappen
            <input
              value={current.buttonLabel}
              maxLength={60}
              onChange={(event) => updatePage({ buttonLabel: event.target.value })}
              className={fieldClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Ekstra knap (valgfri), fx &quot;Integrér dit ur&quot;
              <input
                value={current.actionLabel}
                maxLength={60}
                onChange={(event) => updatePage({ actionLabel: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Ekstra knap går til (intern side)
              <input
                value={current.actionHref}
                maxLength={300}
                placeholder="/settings/integrations"
                onChange={(event) => updatePage({ actionHref: event.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
          <p className="hf-type-small text-text-muted">
            Med tilbage-pilen på siden kommer brugeren tilbage til samme side i guiden. Guiden lukker ikke.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {message && <span className="hf-type-body text-text-secondary sm:mr-auto">{message}</span>}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="hf-btn-danger order-2 h-12 w-full px-4 sm:order-none sm:w-auto"
        >
          Slet flow
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || !name.trim()}
          className="hf-btn-primary order-1 h-12 w-full px-6 sm:order-none sm:w-auto"
        >
          Gem
        </button>
      </div>
    </PhonePreviewEditor>
  );
}
