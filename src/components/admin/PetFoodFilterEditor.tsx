"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FilterView, TermRow } from "@/lib/pet-food-filter-admin";

type ListKey = "strong" | "brand" | "weak";
type TabKey = ListKey | "barcode";

const TABS: { key: TabKey; label: string; help: string }[] = [
  {
    key: "strong",
    label: "Stærke ord",
    help: "Ét træf blokerer. Står ordet i navn, mærke eller ingredienser, afvises varen. Mindst 5 tegn.",
  },
  {
    key: "brand",
    label: "Mærker",
    help: "Dyrefodermærker (fx Royal Canin, Whiskas). Matcher kun som hele ord. Undgå mærker, der også er almindelige ord eller menneskemad (fx Felix, Gourmet).",
  },
  {
    key: "weak",
    label: "Svage ord",
    help: "Blokerer først, når mindst det valgte antal FORSKELLIGE svage ord står i samme vare (fx hund + adult + foder).",
  },
  {
    key: "barcode",
    label: "Stregkoder",
    help: "Spærrede stregkoder. Her ser du kun dine egne ændringer; standardlisten er for lang til at vise. Slå en stregkode fra, hvis en menneskevare er blevet spærret ved en fejl.",
  },
];

const STATE_LABEL = { baseline: "Standard", added: "Tilføjet af admin", removed: "Slået fra" } as const;

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/pet-food-filter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

type TestResult = {
  blocked: boolean;
  barcode: { blocked: boolean; normalised: string } | null;
  text: { blocked: boolean; list: string | null; match: string | null } | null;
};

export function PetFoodFilterEditor({ view, canEdit }: { view: FilterView; canEdit: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("strong");
  const [query, setQuery] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testText, setTestText] = useState("");
  const [testBarcode, setTestBarcode] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const rows: TermRow[] = useMemo(() => {
    const source = tab === "strong" ? view.strong : tab === "brand" ? view.brands : tab === "weak" ? view.weak : [];
    const needle = query.trim().toLowerCase();
    return needle ? source.filter((row) => row.value.includes(needle)) : source;
  }, [tab, view, query]);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    const { ok, data } = await call(body);
    setBusy(false);
    if (!ok) {
      setMessage(typeof data.message === "string" ? data.message : "Kunne ikke gemme ændringen.");
      return false;
    }
    setMessage(success);
    router.refresh();
    return true;
  }

  async function add() {
    if (!newValue.trim()) return;
    if (await run({ op: "add", list: tab, value: newValue, note: newNote }, "Tilføjet — virker inden for ét minut.")) {
      setNewValue("");
      setNewNote("");
    }
  }

  async function runTest() {
    setBusy(true);
    const { ok, data } = await call({ op: "test", text: testText, barcode: testBarcode });
    setBusy(false);
    setTestResult(ok ? (data as unknown as TestResult) : null);
  }

  const listTab = tab !== "barcode";
  const btn = "hf-type-small rounded-full px-3 py-1 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-6">
      <section className="hf-surface flex flex-col gap-3 p-4">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Afprøv filteret</h2>
        <p className="hf-type-small text-text-secondary">
          Skriv et varenavn, mærke eller en ingrediensliste (én linje pr. felt), og/eller en stregkode. Filteret viser, om varen
          ville blive afvist, og hvilket udtryk der udløste det. Intet gemmes.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="hf-type-body flex min-w-[260px] flex-1 flex-col gap-1">
            <span className="text-text-secondary">Tekst</span>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={2}
              placeholder="fx: Royal Canin Mini Adult"
              className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-2"
            />
          </label>
          <label className="hf-type-body flex flex-col gap-1">
            <span className="text-text-secondary">Stregkode</span>
            <input
              value={testBarcode}
              onChange={(e) => setTestBarcode(e.target.value)}
              placeholder="5712873…"
              className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-3"
            />
          </label>
          <button type="button" onClick={runTest} disabled={busy} className={`${btn} bg-hf-green-dark text-hf-white`}>
            Afprøv
          </button>
        </div>
        {testResult && (
          <p className={`hf-type-body ${testResult.blocked ? "text-hf-red-dark" : "text-hf-green-dark"}`}>
            {testResult.blocked ? "Ville blive afvist som dyrefoder." : "Ville IKKE blive afvist."}
            {testResult.barcode && ` Stregkode ${testResult.barcode.normalised}: ${testResult.barcode.blocked ? "på spærrelisten" : "ikke på listen"}.`}
            {testResult.text &&
              ` Tekst: ${
                testResult.text.blocked
                  ? `ramt af ${testResult.text.list === "strong" ? "stærkt ord" : testResult.text.list === "brand" ? "mærke" : "svage ord"} “${testResult.text.match}”.`
                  : "ingen træf."
              }`}
          </p>
        )}
      </section>

      <section className="hf-surface flex flex-col gap-3 p-4">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Antal svage træf</h2>
        <p className="hf-type-small text-text-secondary">
          Hvor mange forskellige svage ord skal stå i samme vare, før den afvises. Standard: {view.minWeakHits.baseline}. Højere tal = færre fejl, men
          flere dyrefodervarer slipper igennem.
        </p>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy || !canEdit}
              onClick={() => run({ op: "setMinWeak", value: n }, `Antal svage træf er nu ${n}.`)}
              className={`${btn} ${view.minWeakHits.effective === n ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="hf-surface flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                setQuery("");
                setMessage(null);
              }}
              className={`${btn} ${tab === item.key ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"}`}
            >
              {item.label}{" "}
              {item.key === "barcode"
                ? `(${view.counts.barcodes.toLocaleString("da-DK")})`
                : `(${view.counts[item.key === "brand" ? "brands" : item.key]})`}
            </button>
          ))}
        </div>
        <p className="hf-type-small text-text-secondary">{TABS.find((item) => item.key === tab)?.help}</p>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="hf-type-body flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-text-secondary">{listTab ? "Nyt udtryk" : "Stregkode at spærre"}</span>
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-3"
              />
            </label>
            <label className="hf-type-body flex min-w-[160px] flex-1 flex-col gap-1">
              <span className="text-text-secondary">Note (valgfri)</span>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-3"
              />
            </label>
            <button type="button" onClick={add} disabled={busy || !newValue.trim()} className={`${btn} bg-hf-green-dark text-hf-white`}>
              Tilføj
            </button>
          </div>
        )}
        {message && <p className="hf-type-small text-text-secondary">{message}</p>}

        {listTab ? (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i listen …"
              className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-3"
            />
            <ul className="max-h-[480px] divide-y divide-border-strong overflow-y-auto rounded-md border border-hf-tan-dark">
              {rows.map((row) => (
                <li key={row.value} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className={`hf-type-body truncate ${row.state === "removed" ? "text-text-muted line-through" : "text-hf-black"}`}>
                      {row.value}
                    </p>
                    <p className="hf-type-small text-text-muted">
                      {STATE_LABEL[row.state]}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  {canEdit &&
                    (row.state === "removed" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run({ op: "restore", list: tab, value: row.value }, "Gendannet.")}
                        className={`${btn} bg-hf-tan text-text-secondary`}
                      >
                        Gendan
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run({ op: "remove", list: tab, value: row.value }, row.state === "added" ? "Slettet." : "Slået fra.")}
                        className={`${btn} bg-hf-red-dark text-hf-white`}
                      >
                        {row.state === "added" ? "Slet" : "Slå fra"}
                      </button>
                    ))}
                </li>
              ))}
              {rows.length === 0 && <li className="hf-type-body px-3 py-4 text-text-muted">Ingen træf.</li>}
            </ul>
          </>
        ) : (
          <>
            <p className="hf-type-body text-text-secondary">
              {view.barcodes.baselineCount.toLocaleString("da-DK")} stregkoder i standardlisten (dyrefoder scrapet fra Bilka, Nemlig, SPAR, Maxi Zoo, Zooplus, Fressnapf, EDEKA24 m.fl.).
              Brug “Afprøv filteret” ovenfor til at se, om en bestemt stregkode er spærret.
            </p>
            <ul className="divide-y divide-border-strong rounded-md border border-hf-tan-dark">
              {view.barcodes.edits.map((edit) => (
                <li key={edit.value} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div>
                    <p className="hf-type-body text-hf-black">{edit.value}</p>
                    <p className="hf-type-small text-text-muted">
                      {edit.action === "ADD" ? "Spærret af admin" : "Standard-stregkode slået fra (menneskemad)"}
                      {edit.note ? ` · ${edit.note}` : ""}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          edit.action === "ADD"
                            ? { op: "remove", list: "barcode", value: edit.value }
                            : { op: "restore", list: "barcode", value: edit.value },
                          "Gemt.",
                        )
                      }
                      className={`${btn} bg-hf-tan text-text-secondary`}
                    >
                      {edit.action === "ADD" ? "Slet" : "Gendan"}
                    </button>
                  )}
                </li>
              ))}
              {view.barcodes.edits.length === 0 && <li className="hf-type-body px-3 py-4 text-text-muted">Ingen egne ændringer endnu.</li>}
            </ul>
            {canEdit && (
              <BarcodeAllow busy={busy} onAllow={(value) => run({ op: "remove", list: "barcode", value }, "Stregkoden er slået fra — varen kan nu oprettes.")} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function BarcodeAllow({ busy, onAllow }: { busy: boolean; onAllow: (value: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="hf-type-body flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="text-text-secondary">Slå en spærret stregkode fra (menneskevare spærret ved en fejl)</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-3"
        />
      </label>
      <button
        type="button"
        disabled={busy || !value.trim()}
        onClick={async () => {
          if (await onAllow(value)) setValue("");
        }}
        className="hf-type-small rounded-full bg-hf-red-dark px-3 py-1 text-hf-white disabled:opacity-50"
      >
        Slå fra
      </button>
    </div>
  );
}
