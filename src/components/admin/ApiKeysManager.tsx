"use client";

import { useState } from "react";
import type { KeyGroupId } from "@/lib/api-keys/catalog";
import type { CheckResult } from "@/lib/api-keys/checks";
import type { FieldStatus, ServiceStatus } from "@/lib/api-keys/status";

// Admin → API-nøgler. Status, redigering og live-test pr. tjeneste
// (docs/DECISIONS.md 2026-09-25 "API-nøgler i admin").

type TestState = CheckResult | "running";

const RESULT_STYLE: Record<CheckResult["status"], string> = {
  ok: "bg-hf-green-light/40 text-hf-green-dark",
  warn: "bg-amber-100 text-amber-800",
  fail: "bg-hf-red-muted/30 text-hf-red-dark",
  missing: "bg-hf-tan text-text-secondary",
};

const RESULT_LABEL: Record<CheckResult["status"], string> = {
  ok: "Virker",
  warn: "Virker delvist",
  fail: "Fejl",
  missing: "Ikke sat op",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function missingFields(service: ServiceStatus) {
  return service.fields.filter((f) => !f.optional && !f.display);
}

async function send(method: "PUT" | "DELETE", body: object) {
  const res = await fetch("/api/admin/api-keys", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
  return data.service as ServiceStatus;
}

export function ApiKeysManager({
  groups,
  initialServices,
}: {
  groups: { id: KeyGroupId; title: string }[];
  initialServices: ServiceStatus[];
}) {
  const [services, setServices] = useState(initialServices);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  async function runTest(serviceId: string) {
    setTests((prev) => ({ ...prev, [serviceId]: "running" }));
    try {
      const res = await fetch("/api/admin/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      const data = (await res.json()) as CheckResult & { message: string };
      setTests((prev) => ({ ...prev, [serviceId]: res.ok ? data : { status: "fail", message: data.message } }));
    } catch {
      setTests((prev) => ({ ...prev, [serviceId]: { status: "fail", message: "Testen kunne ikke nå serveren" } }));
    }
  }

  async function testAll() {
    await Promise.all(services.filter((s) => s.testable).map((s) => runTest(s.id)));
  }

  function replaceService(updated: ServiceStatus) {
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (updated.testable) void runTest(updated.id);
  }

  const incomplete = services.filter((s) => s.group !== "system" && missingFields(s).length > 0);
  const problems = services.filter((s) => {
    const test = tests[s.id];
    return test && test !== "running" && (test.status === "fail" || test.status === "warn");
  });

  return (
    <div className="flex flex-col gap-6" data-allow-clipboard>
      <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-text-primary">Status</p>
          <button
            type="button"
            onClick={testAll}
            className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm font-medium text-hf-white"
          >
            Test alle
          </button>
        </div>
        {incomplete.length === 0 && problems.length === 0 ? (
          <p className="text-sm text-text-secondary">Alle tjenester har deres nøgler.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {problems.map((s) => {
              const test = tests[s.id] as CheckResult;
              return (
                <li key={`p-${s.id}`} className={test.status === "fail" ? "text-hf-red-dark" : "text-amber-800"}>
                  <span className="font-medium">{s.name}:</span> {test.message}
                </li>
              );
            })}
            {incomplete.map((s) => (
              <li key={`m-${s.id}`} className="text-text-secondary">
                <span className="font-medium text-text-primary">{s.name}</span> mangler{" "}
                {missingFields(s)
                  .map((f) => f.label)
                  .join(", ")}
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.map((group) => {
        const groupServices = services.filter((s) => s.group === group.id);
        if (groupServices.length === 0) return null;
        return (
          <section key={group.id} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{group.title}</h2>
            {groupServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                test={tests[service.id]}
                onTest={() => runTest(service.id)}
                onChanged={replaceService}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ServiceCard({
  service,
  test,
  onTest,
  onChanged,
}: {
  service: ServiceStatus;
  test: TestState | undefined;
  onTest: () => void;
  onChanged: (service: ServiceStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">{service.name}</p>
          <p className="text-sm text-text-secondary">{service.purpose}</p>
        </div>
        <div className="flex items-center gap-2">
          {test && test !== "running" && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESULT_STYLE[test.status]}`}>
              {RESULT_LABEL[test.status]}
            </span>
          )}
          {service.testable && (
            <button
              type="button"
              onClick={onTest}
              disabled={test === "running"}
              className="rounded-md border border-hf-green-dark px-3 py-1 text-sm text-hf-green-dark disabled:opacity-50"
            >
              {test === "running" ? "Tester…" : "Test"}
            </button>
          )}
        </div>
      </div>

      {test && test !== "running" && <p className="text-sm text-text-secondary">{test.message}</p>}

      <div className="flex flex-col divide-y divide-border-strong/60">
        {service.fields.map((field) => (
          <FieldRow key={field.key} field={field} onChanged={onChanged} />
        ))}
      </div>

      {service.redirectUris.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-text-muted">Redirect-URI, der skal være registreret hos udbyderen:</p>
          {service.redirectUris.map((uri) => (
            <CopyValue key={uri} value={uri} />
          ))}
        </div>
      )}

      {(service.note || service.setupUrl) && (
        <p className="text-xs text-text-muted">
          {service.note}
          {service.note && service.setupUrl && " "}
          {service.setupUrl && (
            <a href={service.setupUrl} target="_blank" rel="noreferrer" className="text-hf-green-dark underline">
              Åbn udbyderens opsætning
            </a>
          )}
        </p>
      )}
    </div>
  );
}

function SourceTag({ field }: { field: FieldStatus }) {
  if (field.unreadable) {
    return <span className="text-xs text-hf-red-dark">Admin-værdien kan ikke læses — gem den igen</span>;
  }
  if (field.source === "admin") {
    return <span className="text-xs text-hf-green-dark">Rettet i admin {field.updatedAt && formatDate(field.updatedAt)}</span>;
  }
  if (field.source === "env") return <span className="text-xs text-text-muted">Fra .env</span>;
  return (
    <span className={`text-xs ${field.optional ? "text-text-muted" : "text-hf-red-dark"}`}>
      {field.optional ? "Ikke sat (valgfri)" : "Mangler"}
    </span>
  );
}

function FieldRow({ field, onChanged }: { field: FieldStatus; onChanged: (service: ServiceStatus) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    // Id'er og tekst kan rettes i den nuværende værdi; hemmeligheder skrives forfra.
    setValue(field.kind === "secret" ? "" : (field.display ?? ""));
    setError(null);
    setEditing(true);
  }

  async function run(action: () => Promise<ServiceStatus>) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
      setEditing(false);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-border-strong bg-hf-white px-3 py-2 font-mono text-sm text-text-primary";

  return (
    <div className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm text-text-primary">{field.label}</p>
          <p className="font-mono text-xs text-text-muted">{field.key}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourceTag field={field} />
          {field.editable && !editing && (
            <button type="button" onClick={startEdit} className="text-sm text-hf-green-dark underline">
              {field.display ? "Ret" : "Indtast"}
            </button>
          )}
          {field.editable && field.source === "admin" && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => send("DELETE", { key: field.key }))}
              className="text-sm text-text-secondary underline"
            >
              Brug .env igen
            </button>
          )}
        </div>
      </div>

      {field.display && !editing && (
        <p className="break-all font-mono text-sm text-text-secondary">{field.display}</p>
      )}

      {editing && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => send("PUT", { key: field.key, value }));
          }}
        >
          {field.multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={6}
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          ) : (
            <input
              type={field.kind === "secret" ? "password" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete={field.kind === "secret" ? "new-password" : "off"}
              spellCheck={false}
              className={inputClass}
            />
          )}
          {field.hint && <p className="text-xs text-text-muted">{field.hint}</p>}
          {error && <p className="text-sm text-hf-red-dark">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm font-medium text-hf-white disabled:opacity-50"
            >
              {busy ? "Gemmer…" : "Gem"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-sm text-text-secondary"
            >
              Annullér
            </button>
          </div>
        </form>
      )}
      {!editing && error && <p className="text-sm text-hf-red-dark">{error}</p>}
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded bg-hf-tan px-2 py-1 font-mono text-xs text-text-primary">
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 text-xs text-hf-green-dark underline"
      >
        {copied ? "Kopieret" : "Kopiér"}
      </button>
    </div>
  );
}
