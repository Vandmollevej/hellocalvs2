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
  return new Date(iso).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });
}

export function AmountSuggestionRobotPanel({ initial }: { initial: AmountSuggestionRobotView }) {
  const [robot, setRobot] = useState(initial);
  const [draft, setDraft] = useState<AmountSuggestionSettings>(initial.settings);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const dirty = JSON.stringify(draft) !== JSON.stringify(robot.settings);
  const summary = robot.lastRunSummary;

  return (
    <div className="flex flex-col gap-4">
      <section className="hf-surface flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-text-primary hf-type-body hf-type-strong">Mængde-robot</h2>
            <p className="hf-type-caption">
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
              className="hf-btn-secondary hf-btn--compact"
            >
              {robot.enabled ? "Slå fra" : "Slå til"}
            </button>
            <button
              type="button"
              disabled={busy || running}
              onClick={() => send("POST", `${API}/run`, undefined, "Kørsel bestilt — robotten starter inden for et minut.")}
              className="hf-btn-primary hf-btn--compact"
            >
              {running ? "Kører…" : "Kør nu"}
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4 hf-type-small">
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
        {robot.lastError && <p className="text-hf-red-dark hf-type-small">Fejl: {robot.lastError}</p>}
        {message && <p className="text-text-secondary hf-type-body">{message}</p>}
      </section>

      <section className="hf-surface flex flex-col gap-3 p-4">
        <h2 className="text-text-primary hf-type-body hf-type-strong">Indstillinger</h2>
        <label className="flex items-start gap-2 hf-type-body">
          <input
            type="checkbox"
            checked={draft.useInApp}
            onChange={(event) => setDraft({ ...draft, useInApp: event.target.checked })}
            className="hf-native-choice mt-1"
          />
          <span>
            <span className="text-text-primary">Brug forslagene i app&apos;en</span>
            <span className="hf-type-caption block">
              Slået fra: slideren starter som før på 100 g / 1 portion, men robotten regner videre.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {AMOUNT_SUGGESTION_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 hf-type-body">
              <span className="text-text-primary">{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key]}
                onChange={(event) => setDraft({ ...draft, [field.key]: Number(event.target.value) })}
                className="hf-input"
              />
              <span className="hf-type-caption">{field.help}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => send("PATCH", API, { settings: draft }, "Gemt. Robotten bruger de nye indstillinger ved næste kørsel.")}
            className="hf-btn-brand hf-btn--compact hf-btn--inline"
          >
            Gem indstillinger
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDraft(DEFAULT_AMOUNT_SUGGESTION_SETTINGS)}
            className="hf-btn-secondary hf-btn--compact hf-btn--inline"
          >
            Standardværdier
          </button>
        </div>
      </section>
    </div>
  );
}
