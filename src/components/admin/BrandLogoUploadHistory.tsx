"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignLogoUpload,
  createBrandForLogoUpload,
  deleteLogoUploadItems,
  searchBrandsForLogo,
} from "@/app/admin/product-database/logo-upload/actions";
import {
  formatBytes,
  formatClock,
  formatDimensions,
  formatTimestamp,
  type BrandSearchHit,
  type LogoUploadBatch,
  type LogoUploadItem,
} from "@/lib/brand-logo-upload-types";
import { StepList } from "@/components/admin/BrandLogoSteps";

// Oversigt over alle uploadede logoer, ét afsnit pr. parti med tidsstempel
// (admin → Varedatabase → Logo-upload, docs/DECISIONS.md 2026-10-04). Pr. fil:
// størrelse, original-dimensioner, filstørrelse og hele processen. Filer uden
// brand får en brandvælger; fejl kan ryddes ved at slette valgte filer eller
// hele partiet — brandets tidligere logo kommer tilbage.

type Confirm = { ids: string[]; text: string };

const buttonClass = "hf-type-small rounded-md border border-hf-tan-dark bg-hf-white px-3 py-1.5 text-hf-black hover:border-hf-green disabled:opacity-60";
const dangerButtonClass = "hf-type-small rounded-md border border-hf-red-dark bg-hf-white px-3 py-1.5 text-hf-red-dark hover:bg-hf-red-muted disabled:opacity-60";

export function BrandLogoUploadHistory({ batches, canEdit }: { batches: LogoUploadBatch[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBatch(batch: LogoUploadBatch) {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = batch.items.every((item) => next.has(item.id));
      for (const item of batch.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function refresh(message?: { ok: boolean; text: string }) {
    if (message) setNotice(message);
    startTransition(() => router.refresh());
  }

  function runDelete(ids: string[]) {
    setConfirm(null);
    startTransition(async () => {
      const result = await deleteLogoUploadItems(ids);
      setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
      setNotice({ ok: result.ok, text: result.message ?? (result.ok ? "Slettet" : "Kunne ikke slette") });
      router.refresh();
    });
  }

  function runUse(item: LogoUploadItem) {
    if (!item.brandId) return;
    const brandId = item.brandId;
    startTransition(async () => {
      const result = await assignLogoUpload(item.id, brandId);
      setNotice({ ok: result.ok, text: result.ok ? `Sat som logo på ${item.brandName}` : result.message });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4" aria-busy={pending}>
      <h2 className="hf-type-card-title text-hf-black">Uploads</h2>
      {notice && (
        <p className={`hf-type-body ${notice.ok ? "text-hf-green-dark" : "text-hf-red-dark"}`} role="status">
          {notice.text}
        </p>
      )}
      {batches.length === 0 && <p className="hf-type-body text-text-secondary">Ingen uploads endnu. Træk de første logoer ind ovenfor.</p>}

      {batches.map((batch) => {
        const inUse = batch.items.filter((item) => item.inUse).length;
        const unmatched = batch.items.filter((item) => item.status === "UNMATCHED").length;
        const failed = batch.items.filter((item) => item.status === "FAILED").length;
        const selectedHere = batch.items.filter((item) => selected.has(item.id));
        const allSelected = batch.items.length > 0 && selectedHere.length === batch.items.length;
        const batchConfirm = confirm && confirm.ids.every((id) => batch.items.some((item) => item.id === id)) ? confirm : null;

        return (
          <article key={batch.id} className="hf-panel">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="hf-type-body-lg hf-type-strong text-hf-black">Parti {formatTimestamp(batch.createdAt)}</h3>
                <p className="hf-type-body text-text-secondary">
                  {batch.items.length} {batch.items.length === 1 ? "fil" : "filer"} · <span className="text-hf-green-dark">{inUse} i brug</span>
                  {unmatched > 0 && <span className="text-hf-warning"> · {unmatched} mangler brand</span>}
                  {failed > 0 && <span className="text-hf-red-dark"> · {failed} fejlede</span>}
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={buttonClass} onClick={() => toggleBatch(batch)}>
                    {allSelected ? "Fravælg alle" : "Vælg alle"}
                  </button>
                  {selectedHere.length > 0 && (
                    <button
                      type="button"
                      className={dangerButtonClass}
                      disabled={pending}
                      onClick={() =>
                        setConfirm({
                          ids: selectedHere.map((item) => item.id),
                          text: `Slet ${selectedHere.length} valgte ${selectedHere.length === 1 ? "logo" : "logoer"}?`,
                        })
                      }
                    >
                      Slet valgte ({selectedHere.length})
                    </button>
                  )}
                  <button
                    type="button"
                    className={dangerButtonClass}
                    disabled={pending}
                    onClick={() =>
                      setConfirm({
                        ids: batch.items.map((item) => item.id),
                        text: `Slet hele partiet fra ${formatTimestamp(batch.createdAt)} (${batch.items.length} ${batch.items.length === 1 ? "fil" : "filer"})?`,
                      })
                    }
                  >
                    Slet hele partiet
                  </button>
                </div>
              )}
              {batchConfirm && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-hf-red-dark bg-hf-red-muted p-3" role="alertdialog">
                  <p className="hf-type-body min-w-0 flex-1 text-hf-black">
                    {batchConfirm.text} Filerne fjernes, og brands, der fik logo herfra, får det tidligere logo tilbage.
                  </p>
                  <button type="button" className={dangerButtonClass} disabled={pending} onClick={() => runDelete(batchConfirm.ids)}>
                    Ja, slet
                  </button>
                  <button type="button" className={buttonClass} onClick={() => setConfirm(null)}>
                    Annullér
                  </button>
                </div>
              )}
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] border-collapse text-left">
                <thead>
                  <tr className="hf-type-small border-b border-hf-tan-dark text-text-muted">
                    {canEdit && <th className="w-8 py-2 pr-2" aria-label="Vælg" />}
                    <th className="w-20 py-2 pr-3">Logo</th>
                    <th className="py-2 pr-3">Fil og brand</th>
                    <th className="py-2 pr-3">Størrelse</th>
                    <th className="py-2 pr-3">Original</th>
                    <th className="py-2 pr-3">Filstørrelse</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">
                      <span className="sr-only">Handlinger</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((item) => (
                    <Fragment key={item.id}>
                      <tr className="border-b border-hf-tan align-top">
                        {canEdit && (
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              onChange={() => toggle(item.id)}
                              aria-label={`Vælg ${item.fileName}`}
                              className="mt-1 h-4 w-4 accent-hf-green-dark"
                            />
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          <Thumb item={item} />
                        </td>
                        <td className="py-2 pr-3">
                          <p className="hf-type-body hf-type-strong break-words text-hf-black">{item.fileName}</p>
                          <p className="hf-type-small text-text-muted">{formatClock(item.createdAt)}</p>
                          {item.status === "UNMATCHED" ? (
                            canEdit ? (
                              <BrandPicker item={item} onChanged={refresh} />
                            ) : (
                              <p className="hf-type-small text-hf-warning">Mangler brand</p>
                            )
                          ) : (
                            item.brandName && <p className="hf-type-body text-hf-green-dark">→ {item.brandName}</p>
                          )}
                        </td>
                        <td className="hf-type-body py-2 pr-3 text-hf-black">{formatDimensions(item.width, item.height)}</td>
                        <td className="py-2 pr-3">
                          <p className="hf-type-body text-hf-black">{formatDimensions(item.originalWidth, item.originalHeight)}</p>
                          {item.originalType && <p className="hf-type-small text-text-muted">{item.originalType}</p>}
                        </td>
                        <td className="py-2 pr-3">
                          <p className="hf-type-body text-hf-black">{formatBytes(item.bytes)}</p>
                          {item.originalBytes ? <p className="hf-type-small text-text-muted">original {formatBytes(item.originalBytes)}</p> : null}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusText item={item} />
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className={buttonClass}
                              aria-expanded={openItem === item.id}
                              onClick={() => setOpenItem(openItem === item.id ? null : item.id)}
                            >
                              {openItem === item.id ? "Skjul proces" : "Vis proces"}
                            </button>
                            {canEdit && item.status === "DONE" && !item.inUse && item.brandId && (
                              <button type="button" className={buttonClass} disabled={pending} onClick={() => runUse(item)}>
                                Brug som logo
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                className={dangerButtonClass}
                                disabled={pending}
                                onClick={() => setConfirm({ ids: [item.id], text: `Slet «${item.fileName}»?` })}
                              >
                                Slet
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {openItem === item.id && (
                        <tr className="border-b border-hf-tan-dark">
                          <td colSpan={canEdit ? 8 : 7} className="p-3">
                            <div className="rounded-md bg-hf-tan p-3">
                              <p className="hf-type-small mb-2 text-text-muted">Proces for {item.fileName}</p>
                              <StepList steps={item.steps} />
                              {item.message && <p className="hf-type-small mt-2 text-text-secondary">{item.message}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function Thumb({ item }: { item: LogoUploadItem }) {
  if (!item.imageUrl) {
    return (
      <div className="hf-type-micro flex h-12 w-16 items-center justify-center rounded border border-hf-tan-dark bg-hf-tan text-text-muted">
        Intet
      </div>
    );
  }
  return (
    <div className="flex h-12 w-16 items-center justify-center overflow-hidden rounded border border-hf-tan-dark bg-hf-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.imageUrl} alt={item.brandName ?? item.fileName} loading="lazy" className="h-full w-full object-contain p-1" />
    </div>
  );
}

function StatusText({ item }: { item: LogoUploadItem }) {
  if (item.status === "FAILED") {
    return (
      <div>
        <p className="hf-type-body text-hf-red-dark">Fejlede</p>
        {item.message && <p className="hf-type-small text-hf-red-dark">{item.message}</p>}
      </div>
    );
  }
  if (item.status === "UNMATCHED") return <p className="hf-type-body text-hf-warning">Mangler brand</p>;
  if (item.inUse) return <p className="hf-type-body text-hf-green-dark">I brug som logo</p>;
  if (item.applied) return <p className="hf-type-body text-text-muted">Erstattet af en anden fil</p>;
  return <p className="hf-type-body text-text-muted">Ekstra udgave — ikke i brug</p>;
}

// Vælg et eksisterende brand (søg) eller opret det ud fra filnavnet.
function BrandPicker({ item, onChanged }: { item: LogoUploadItem; onChanged: (message?: { ok: boolean; text: string }) => void }) {
  const [query, setQuery] = useState(item.suggestedName);
  const [hits, setHits] = useState<BrandSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      void searchBrandsForLogo(trimmed).then((found) => {
        if (!cancelled) setHits(found);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed]);

  const shown = trimmed ? hits : [];
  const exact = shown.some((hit) => hit.name.toLowerCase() === trimmed.toLowerCase());

  async function assign(hit: BrandSearchHit) {
    setBusy(true);
    setError(null);
    const result = await assignLogoUpload(item.id, hit.id);
    setBusy(false);
    if (result.ok) onChanged({ ok: true, text: `«${item.fileName}» er sat som logo på ${hit.name}` });
    else setError(result.message);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const result = await createBrandForLogoUpload(item.id, trimmed);
    setBusy(false);
    if (result.ok) onChanged({ ok: true, text: result.message ?? `«${item.fileName}» er sat som logo på ${trimmed}` });
    else setError(result.message);
  }

  return (
    <div className="mt-1 flex max-w-sm flex-col gap-1.5">
      <p className="hf-type-small text-hf-warning">Intet brand hedder «{item.suggestedName}». Vælg brand:</p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Søg efter brand"
        aria-label={`Brand for ${item.fileName}`}
        className="hf-type-body hf-field w-full rounded-md border border-hf-tan-dark bg-hf-white px-2 text-hf-black"
      />
      {shown.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-md border border-hf-tan-dark bg-hf-white">
          {shown.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void assign(hit)}
                className="hf-type-body flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-hf-black hover:bg-hf-tan disabled:opacity-60"
              >
                <span className="truncate">{hit.name}</span>
                {hit.logoUrl && <span className="hf-type-micro flex-none text-text-muted">har logo — erstattes</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {trimmed && !exact && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="hf-type-small rounded-md border border-hf-green-dark px-3 py-1.5 text-left text-hf-green-dark disabled:opacity-60"
        >
          Opret nyt brand «{trimmed}»
        </button>
      )}
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
    </div>
  );
}
