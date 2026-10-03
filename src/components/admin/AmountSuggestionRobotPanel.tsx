"use client";

import { useEffect, useState } from "react";
import type { AmountSuggestionRobotView } from "@/lib/robots";
import {
  AMOUNT_SUGGESTION_FIELDS,
  DEFAULT_AMOUNT_SUGGESTION_SETTINGS,
  type AmountSuggestionSettings,
} from "@/lib/amount-suggestion-config";

const API = "/api/admin/robots/amount-suggestion";

function formatTime(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

const CONTEXT_LABEL = { EATEN: "Spist", RECIPE: "Opskrift" } as const;

type TestResult = { grams: number; source: string; confidence: number } | null;

export function AmountSuggestionRobotPanel({ initial }: { initial: AmountSuggestionRobotView }) {
  const [robot, setRobot] = useState(initial);
  const [draft, setDraft] = useState<AmountSuggestionSettings>(initial.settings);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testItemId, setTestItemId] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [testContext, setTestContext] = useState<"EATEN" | "RECIPE">("EATEN");
  const [testResult, setTestResult] = useState<TestResult | "none" | null>(null);

  const running =
    robot.lastRunStatus === "RUNNING" ||
    Boolean(robot.runRequestedAt && (!robot.lastRunStartedAt || robot.runRequestedAt > robot.lastRunStartedAt));

  // Genindlæs status, mens en kørsel er bestilt eller i gang.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const res = await fetch(API);
      if (res.ok) setRobot((await res.json()).robot);
    }, 5000);
    return () => clearInterval(timer);
  }, [running]);

  async function send(method: "PATCH" | "POST", url: string, body?: unknown, okMessage?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const next = (await res.json()).robot as AmountSuggestionRobotView;
      setRobot(next);
      setDraft(next.settings);
      if (okMessage) setMessage(okMessage);
    } catch {
      setMessage("Kunne ikke gemme — prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    if (!testItemId.trim()) return;
    const params = new URLSearchParams({ itemId: testItemId.trim(), context: testContext });
    if (testUserId.trim()) params.set("userId", testUserId.trim());
    const res = await fetch(`${API}/test?${params}`);
    const data = await res.json().catch(() => ({}));
    setTestResult(data.suggestion ?? "none");
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(robot.settings);
  const summary = robot.lastRunSummary;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Mængde-robot</h2>
            <p className="text-xs text-text-secondary">
              Container <code>amount-suggestion-agent</code> ·{" "}
              <span className={robot.online ? "text-hf-green-dark" : "text-hf-red-dark"}>
                {robot.online ? "kører" : "ingen kontakt"}
              </span>{" "}
              (sidst set {formatTime(robot.heartbeatAt)})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send("PATCH", API, { enabled: !robot.enabled }, robot.enabled ? "Robotten er slået fra." : "Robotten er slået til.")}
              className="rounded-md border border-border-strong px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan disabled:opacity-50"
            >
              {robot.enabled ? "Slå fra" : "Slå til"}
            </button>
            <button
              type="button"
              disabled={busy || running}
              onClick={() => send("POST", `${API}/run`, undefined, "Kørsel bestilt — robotten starter inden for et minut.")}
              className="rounded-md bg-hf-green-dark px-4 py-2 text-sm font-medium text-hf-white disabled:opacity-50"
            >
              {running ? "Kører…" : "Kør nu"}
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <dt className="text-text-muted">Status</dt>
          <dd className="text-text-primary">{robot.enabled ? (robot.lastRunStatus ?? "Ikke kørt endnu") : "Slået fra"}</dd>
          <dt className="text-text-muted">Seneste kørsel</dt>
          <dd className="text-text-primary">{formatTime(robot.lastRunFinishedAt)}</dd>
          <dt className="text-text-muted">Varer med forslag</dt>
          <dd className="text-text-primary">{summary?.items ?? "–"}</dd>
          <dt className="text-text-muted">Kategorier</dt>
          <dd className="text-text-primary">{summary?.categories ?? "–"}</dd>
          <dt className="text-text-muted">Valg analyseret</dt>
          <dd className="text-text-primary">{summary?.samples ?? "–"}</dd>
          <dt className="text-text-muted">For få brugere</dt>
          <dd className="text-text-primary">{summary?.tooFewUsers ?? "–"}</dd>
          <dt className="text-text-muted">Varighed</dt>
          <dd className="text-text-primary">{summary?.durationMs != null ? `${summary.durationMs} ms` : "–"}</dd>
        </dl>
        {robot.lastError && <p className="text-xs text-hf-red-dark">Fejl: {robot.lastError}</p>}
        {message && <p className="text-sm text-text-secondary">{message}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-text-primary">Indstillinger</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.useInApp}
            onChange={(event) => setDraft({ ...draft, useInApp: event.target.checked })}
            className="mt-1"
          />
          <span>
            <span className="text-text-primary">Brug forslagene i app&apos;en</span>
            <span className="block text-xs text-text-secondary">
              Slået fra: slideren starter som før på 100 g / 1 portion, men robotten regner videre.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {AMOUNT_SUGGESTION_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              <span className="text-text-primary">{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: Number(event.target.value) })}
                className="rounded-md border border-border-strong px-3 py-2 text-sm"
              />
              <span className="text-xs text-text-secondary">{field.help}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => send("PATCH", API, { settings: draft }, "Gemt. Robotten bruger de nye indstillinger ved næste kørsel.")}
            className="rounded-md bg-hf-green-dark px-4 py-2 text-sm font-medium text-hf-white disabled:opacity-50"
          >
            Gem indstillinger
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDraft(DEFAULT_AMOUNT_SUGGESTION_SETTINGS)}
            className="rounded-md border border-border-strong px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan"
          >
            Standardværdier
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-text-primary">Test et forslag</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            <span className="text-text-secondary">Vare-id (produkt eller løs ingrediens)</span>
            <input
              value={testItemId}
              onChange={(event) => setTestItemId(event.target.value)}
              className="rounded-md border border-border-strong px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            <span className="text-text-secondary">Bruger-id (valgfrit)</span>
            <input
              value={testUserId}
              onChange={(event) => setTestUserId(event.target.value)}
              className="rounded-md border border-border-strong px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Kontekst</span>
            <select
              value={testContext}
              onChange={(event) => setTestContext(event.target.value as "EATEN" | "RECIPE")}
              className="rounded-md border border-border-strong px-3 py-2 text-sm"
            >
              <option value="EATEN">Spist</option>
              <option value="RECIPE">Opskrift</option>
            </select>
          </label>
          <button
            type="button"
            onClick={runTest}
            className="rounded-md border border-border-strong px-3 py-2 text-sm text-text-secondary hover:bg-hf-tan"
          >
            Beregn
          </button>
        </div>
        {testResult === "none" && (
          <p className="text-xs text-text-secondary">
            Intet forslag (ingen data, eller forslag er slået fra i app&apos;en) — slideren starter på standarden.
          </p>
        )}
        {testResult && testResult !== "none" && (
          <p className="text-sm text-text-primary">
            {testResult.grams} g · kilde: {testResult.source} · sikkerhed {Math.round(testResult.confidence * 100)} %
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-2 p-4">
        <h2 className="text-sm font-medium text-text-primary">
          Forslag med flest brugere bag ({robot.suggestionCount} i alt)
        </h2>
        {robot.topSuggestions.length === 0 ? (
          <p className="text-xs text-text-muted">Ingen forslag endnu — kræver mindst {robot.settings.minUsers} brugere pr. vare.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="py-1 pr-3 font-normal">Vare</th>
                  <th className="py-1 pr-3 font-normal">Kontekst</th>
                  <th className="py-1 pr-3 font-normal">Forslag</th>
                  <th className="py-1 pr-3 font-normal">Typisk spænd</th>
                  <th className="py-1 pr-3 font-normal">Sikkerhed</th>
                  <th className="py-1 pr-3 font-normal">Brugere / valg</th>
                </tr>
              </thead>
              <tbody>
                {robot.topSuggestions.map((row) => (
                  <tr key={row.id} className="border-t border-border-strong">
                    <td className="py-1 pr-3 text-text-primary">{row.name}</td>
                    <td className="py-1 pr-3 text-text-secondary">{CONTEXT_LABEL[row.context]}</td>
                    <td className="py-1 pr-3 text-text-primary">{Math.round(row.grams)} g</td>
                    <td className="py-1 pr-3 text-text-secondary">
                      {row.p25 != null && row.p75 != null ? `${Math.round(row.p25)}–${Math.round(row.p75)} g` : "–"}
                    </td>
                    <td className="py-1 pr-3 text-text-secondary">{Math.round(row.confidence * 100)} %</td>
                    <td className="py-1 pr-3 text-text-secondary">
                      {row.userCount} / {row.sampleCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
