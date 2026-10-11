"use client";

import { useEffect, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { KeyGroupId } from "@/lib/api-keys/catalog";
import type { CheckResult } from "@/lib/api-keys/checks";
import type { FieldStatus, ServiceStatus } from "@/lib/api-keys/status";
import type { CustomApiView } from "@/lib/api-keys/custom";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

// Admin → API-nøgler. Status, redigering og live-test pr. tjeneste
// (docs/DECISIONS.md 2026-09-25 "API-nøgler i admin").

type TestState = CheckResult | "running";

const RESULT_STYLE: Record<CheckResult["status"], string> = {
  ok: "bg-hf-green-light/40 text-hf-green-dark",
  warn: "bg-hf-warning-bg text-hf-warning",
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
  return new Date(iso).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "short" });
}

// Alle tjenester har deres eget transparente 1:1-bomærke i public/api-logos/<id>.png
// (kilder og fremgangsmåde: docs/REGLER.md → "API-logoer").
function ServiceLogo({ service, inactive }: { service: ServiceStatus; inactive: boolean }) {
  // Rød ring om tjenester, der mangler nøgler (inaktive).
  const ring = inactive ? "border-2 border-hf-red-dark" : "border border-hf-tan-dark";
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hf-white ${ring}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api-logos/${service.id}.png`} alt="" className="h-7 w-7 object-contain" />
    </span>
  );
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

type CustomState = { groups: string[]; apis: CustomApiView[] };

async function sendCustom(method: "POST" | "DELETE", body: object) {
  const res = await fetch("/api/admin/api-keys/custom", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
  return data as CustomState;
}

export function ApiKeysManager({
  groups,
  initialServices,
  initialCustom,
}: {
  groups: { id: KeyGroupId; title: string }[];
  initialServices: ServiceStatus[];
  initialCustom: CustomState;
}) {
  const { ask, sheet } = useConfirmSheet();
  const [services, setServices] = useState(initialServices);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [custom, setCustom] = useState(initialCustom);
  const [addingGroup, setAddingGroup] = useState(false);
  const [addingApiIn, setAddingApiIn] = useState<string | null>(null);
  // Tjenestekortene er foldet sammen som standard; kun første linje (logo, navn, test) vises.
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  function setOpen(id: string, open: boolean) {
    setOpenIds((prev) => ({ ...prev, [id]: open }));
  }

  // Et link med #tjeneste (fx fra statuslisten) folder det rigtige kort ud.
  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.slice(1);
      if (id) setOpenIds((prev) => ({ ...prev, [id]: true }));
    };
    const first = window.setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  const allGroupTitles = [...groups.map((g) => g.title), ...custom.groups.filter((g) => !groups.some((b) => b.title === g))];

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
      {sheet}
      <div className="hf-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="hf-type-body hf-type-strong text-hf-black">Status</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddingGroup(true)}
              className="hf-btn-secondary hf-btn--compact hf-btn--inline"
            >
              Tilføj gruppe
            </button>
            <button
              type="button"
              onClick={() => setAddingApiIn(allGroupTitles[0] ?? "")}
              className="hf-btn-secondary hf-btn--compact hf-btn--inline"
            >
              Tilføj API
            </button>
            <button
              type="button"
              onClick={testAll}
              className="hf-btn-brand hf-btn--compact hf-btn--inline"
            >
              Test alle
            </button>
          </div>
        </div>
        {addingGroup && (
          <AddGroupForm
            onCancel={() => setAddingGroup(false)}
            onSave={async (title) => {
              setCustom(await sendCustom("POST", { type: "group", title }));
              setAddingGroup(false);
            }}
          />
        )}
        {addingApiIn !== null && (
          <AddApiForm
            groups={allGroupTitles}
            initialGroup={addingApiIn}
            onCancel={() => setAddingApiIn(null)}
            onSave={async (input) => {
              setCustom(await sendCustom("POST", { type: "api", ...input }));
              setAddingApiIn(null);
            }}
          />
        )}
        {incomplete.length === 0 && problems.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Alle tjenester har deres nøgler.</p>
        ) : (
          <ul className="hf-type-body flex flex-col gap-1">
            {problems.map((s) => {
              const test = tests[s.id] as CheckResult;
              return (
                <li key={`p-${s.id}`} className={test.status === "fail" ? "text-hf-red-dark" : "text-hf-warning"}>
                  <a href={`#${s.id}`} onClick={() => setOpen(s.id, true)} className="hf-type-strong underline">
                    {s.name}:
                  </a>{" "}
                  {test.message}
                </li>
              );
            })}
            {incomplete.map((s) => (
              <li key={`m-${s.id}`} className="text-text-secondary">
                <a href={`#${s.id}`} onClick={() => setOpen(s.id, true)} className="hf-type-strong text-hf-black underline">
                  {s.name}
                </a>{" "}
                mangler{" "}
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
            <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">{group.title}</h2>
            {groupServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                test={tests[service.id]}
                open={Boolean(openIds[service.id])}
                onToggle={() => setOpen(service.id, !openIds[service.id])}
                onTest={() => runTest(service.id)}
                onChanged={replaceService}
              />
            ))}
          </section>
        );
      })}

      {custom.groups.map((title) => {
        const apis = custom.apis.filter((a) => a.group === title);
        return (
          <section key={`custom-${title}`} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="hf-type-body hf-type-strong uppercase tracking-wide text-text-muted">{title}</h2>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAddingApiIn(title)} className="hf-btn-text text-hf-green-dark">
                  Tilføj API
                </button>
                {apis.length === 0 && (
                  <button
                    type="button"
                    onClick={async () => setCustom(await sendCustom("DELETE", { type: "group", title }))}
                    className="hf-btn-text text-text-secondary"
                  >
                    Slet gruppe
                  </button>
                )}
              </div>
            </div>
            {apis.length === 0 && <p className="hf-type-body text-text-secondary">Ingen API’er i gruppen endnu.</p>}
            {apis.map((api) => (
              <div key={api.id} className="hf-panel">
                <div className="flex items-start justify-between gap-3">
                  <p className="hf-type-strong text-hf-black">{api.name}</p>
                  <button
                    type="button"
                    onClick={() =>
                      ask(`Slet ${api.name}?`, () => {
                        void (async () => setCustom(await sendCustom("DELETE", { type: "api", id: api.id })))();
                      })
                    }
                    className="hf-btn-text text-hf-red-dark"
                  >
                    Slet
                  </button>
                </div>
                <div>
                  <p className="hf-type-small text-text-muted">ID</p>
                  <p className="hf-type-body break-all font-mono text-text-secondary">{api.keyId}</p>
                </div>
                <div>
                  <p className="hf-type-small text-text-muted">Hemmelighed</p>
                  <p className="hf-type-body break-all font-mono text-text-secondary">{api.secretDisplay}</p>
                </div>
                {api.manageUrl ? (
                  <ManageLinkLine url={api.manageUrl} where={api.manageUrl} />
                ) : (
                  <p className="hf-type-small text-hf-warning">
                    Mangler link til siden, hvor nøglen styres — slet og tilføj API’et igen med linket.
                  </p>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

const formInputClass = "hf-input w-full";

function AddGroupForm({ onSave, onCancel }: { onSave: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2 border-t border-hf-tan-dark pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave(title);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke gemme");
          setBusy(false);
        }
      }}
    >
      <p className="hf-type-body hf-type-strong text-hf-black">Ny gruppe</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gruppens navn" className={formInputClass} />
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="hf-btn-brand hf-btn--compact hf-btn--inline"
        >
          {busy ? "Gemmer…" : "Gem"}
        </button>
        <button type="button" onClick={onCancel} className="hf-btn-text text-text-secondary">
          Annullér
        </button>
      </div>
    </form>
  );
}

function AddApiForm({
  groups,
  initialGroup,
  onSave,
  onCancel,
}: {
  groups: string[];
  initialGroup: string;
  onSave: (input: { group: string; name: string; keyId: string; secret: string; manageUrl: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [group, setGroup] = useState(initialGroup);
  const [name, setName] = useState("");
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [manageUrl, setManageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = group && name.trim() && keyId.trim() && secret.trim() && manageUrl.trim();
  return (
    <form
      className="flex flex-col gap-2 border-t border-hf-tan-dark pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave({ group, name, keyId, secret, manageUrl });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke gemme");
          setBusy(false);
        }
      }}
    >
      <p className="hf-type-body hf-type-strong text-hf-black">Nyt API</p>
      <select value={group} onChange={(e) => setGroup(e.target.value)} className={formInputClass}>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn" className={formInputClass} />
      <input
        value={keyId}
        onChange={(e) => setKeyId(e.target.value)}
        placeholder="ID"
        autoComplete="off"
        spellCheck={false}
        className={`${formInputClass} font-mono`}
      />
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Hemmelighed"
        autoComplete="new-password"
        spellCheck={false}
        className={`${formInputClass} font-mono`}
      />
      <input
        type="url"
        value={manageUrl}
        onChange={(e) => setManageUrl(e.target.value)}
        placeholder="Link til siden hos udbyderen, hvor nøglen styres (https://…)"
        autoComplete="off"
        spellCheck={false}
        className={formInputClass}
      />
      <p className="hf-type-small text-text-muted">
        Indsæt den præcise side, hvor ID og hemmelighed findes — ikke udbyderens forside.
      </p>
      {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !ready}
          className="hf-btn-brand hf-btn--compact hf-btn--inline"
        >
          {busy ? "Gemmer…" : "Gem"}
        </button>
        <button type="button" onClick={onCancel} className="hf-btn-text text-text-secondary">
          Annullér
        </button>
      </div>
    </form>
  );
}

function ServiceCard({
  service,
  test,
  open,
  onToggle,
  onTest,
  onChanged,
}: {
  service: ServiceStatus;
  test: TestState | undefined;
  open: boolean;
  onToggle: () => void;
  onTest: () => void;
  onChanged: (service: ServiceStatus) => void;
}) {
  return (
    <div id={service.id} className="hf-panel scroll-mt-20">
      {/* Første linje (logo, navn, test) er altid synlig og folder resten ud/sammen. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="hf-btn-text min-w-0 flex-1"
        >
          <ServiceLogo service={service} inactive={missingFields(service).length > 0} />
          <span className="min-w-0">
            <span className="hf-type-strong block text-hf-black">{service.name}</span>
            <span className="hf-type-body block text-text-secondary">{service.purpose}</span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {test && test !== "running" && (
            <span className={`hf-type-small hf-type-strong rounded-full px-2 py-0.5 ${RESULT_STYLE[test.status]}`}>
              {RESULT_LABEL[test.status]}
            </span>
          )}
          {service.testable && (
            <button
              type="button"
              onClick={onTest}
              disabled={test === "running"}
              className="hf-btn-secondary hf-btn--compact"
            >
              {test === "running" ? "Tester…" : "Test"}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            title={open ? "Fold sammen" : "Fold ud"}
            className="flex h-8 w-8 items-center justify-center text-text-muted"
          >
            <IconChevronDown size={18} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          </button>
        </div>
      </div>

      {open && (
        <>
          {test && test !== "running" && <p className="hf-type-body text-text-secondary">{test.message}</p>}

          <div className="flex flex-col divide-y divide-border-strong/60">
            {service.fields.map((field) => (
              <FieldRow key={field.key} field={field} onChanged={onChanged} />
            ))}
          </div>

          {service.redirectUris.length > 0 && (
            <div className="hf-type-body flex flex-col gap-1">
              <p className="text-text-muted">Redirect-URI, der skal være registreret hos udbyderen:</p>
              {service.redirectUris.map((uri) => (
                <CopyValue key={uri} value={uri} />
              ))}
            </div>
          )}

          {(service.note || service.setupUrl) && (
            <p className="hf-type-small text-text-muted">
              {service.note}
              {service.note && service.setupUrl && " "}
              {service.setupUrl && (
                <a href={service.setupUrl} target="_blank" rel="noreferrer" className="break-all text-hf-green-dark underline">
                  {service.setupUrl}
                </a>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SourceTag({ field }: { field: FieldStatus }) {
  if (field.unreadable) {
    return <span className="hf-type-small text-hf-red-dark">Admin-værdien kan ikke læses — gem den igen</span>;
  }
  if (field.source === "admin") {
    return <span className="hf-type-small text-hf-green-dark">Rettet i admin {field.updatedAt && formatDate(field.updatedAt)}</span>;
  }
  if (field.source === "env") return <span className="hf-type-small text-text-muted">Sat på serveren (.env-filen)</span>;
  return (
    <span className={`hf-type-small ${field.optional ? "text-text-muted" : "text-hf-red-dark"}`}>
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

  const inputClass = "hf-input w-full font-mono";

  return (
    <div className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="hf-type-body text-hf-black">{field.label}</p>
          <p className="hf-type-small font-mono text-text-muted">{field.key}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SourceTag field={field} />
          {field.editable && !editing && (
            <button type="button" onClick={startEdit} className="hf-btn-text text-hf-green-dark">
              {field.display ? "Ret" : "Indtast"}
            </button>
          )}
          {field.editable && field.source === "admin" && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => send("DELETE", { key: field.key }))}
              className="hf-btn-text text-text-secondary"
            >
              Brug .env igen
            </button>
          )}
        </div>
      </div>

      {field.display && !editing && (
        <p className="hf-type-body break-all font-mono text-text-secondary">{field.display}</p>
      )}

      <ManageLinkLine url={field.manageUrl} where={field.manageWhere} />

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
          {field.hint && <p className="hf-type-small text-text-muted">{field.hint}</p>}
          {error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="hf-btn-brand hf-btn--compact hf-btn--inline"
            >
              {busy ? "Gemmer…" : "Gem"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="hf-btn-text text-text-secondary"
            >
              Annullér
            </button>
          </div>
        </form>
      )}
      {!editing && error && <p className="hf-type-body text-hf-red-dark">{error}</p>}
    </div>
  );
}

function ManageLinkLine({ url, where }: { url: string; where: string }) {
  return (
    <p className="hf-type-small text-text-muted">
      Styres her:{" "}
      <a href={url} target="_blank" rel="noreferrer" className="break-all text-hf-green-dark underline">
        {where}
      </a>
    </p>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="hf-type-small min-w-0 flex-1 break-all rounded bg-hf-tan px-2 py-1 font-mono text-hf-black">
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="hf-btn-text shrink-0 text-hf-green-dark"
      >
        {copied ? "Kopieret" : "Kopiér"}
      </button>
    </div>
  );
}
