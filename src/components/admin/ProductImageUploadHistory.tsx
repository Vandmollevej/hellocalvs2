"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteImageUploadItems } from "@/app/admin/product-database/image-upload/actions";
import { formatBytes, formatClock, formatDimensions, formatTimestamp } from "@/lib/brand-logo-upload-types";
import {
  ROLE_LABEL,
  targetsLabel,
  type ProductImageUploadBatch,
  type ProductImageUploadItem,
} from "@/lib/product-image-upload-types";
import { StepList } from "@/components/admin/BrandLogoSteps";
import { CheckerThumb } from "@/components/admin/ImageCompare";

// Oversigt over alle uploadede produktbilleder, ét afsnit pr. parti med
// tidsstempel (admin → Billed-upload, docs/DECISIONS.md 2026-10-04). Pr. fil:
// størrelse, original-dimensioner, filstørrelse, status og hele processen.
// Fejl kan ryddes ved at slette valgte filer eller hele partiet — varernes
// tidligere billeder kommer tilbage.

type Confirm = { ids: string[]; text: string };

const buttonClass = "hf-type-small rounded-md border border-hf-tan-dark bg-hf-white px-3 py-1.5 text-hf-black hover:border-hf-green disabled:opacity-60";
const dangerButtonClass = "hf-type-small rounded-md border border-hf-red-dark bg-hf-white px-3 py-1.5 text-hf-red-dark hover:bg-hf-red-muted disabled:opacity-60";

export function ProductImageUploadHistory({ batches, canEdit }: { batches: ProductImageUploadBatch[]; canEdit: boolean }) {
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

  function toggleBatch(batch: ProductImageUploadBatch) {
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

  function runDelete(ids: string[]) {
    setConfirm(null);
    startTransition(async () => {
      const result = await deleteImageUploadItems(ids);
      setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
      setNotice({ ok: result.ok, text: result.message ?? (result.ok ? "Slettet" : "Kunne ikke slette") });
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
      {batches.length === 0 && <p className="hf-type-body text-text-secondary">Ingen uploads endnu. Træk de første produktbilleder ind ovenfor.</p>}

      {batches.map((batch) => {
        const count = (status: ProductImageUploadItem["status"]) => batch.items.filter((item) => item.status === status).length;
        const selectedHere = batch.items.filter((item) => selected.has(item.id));
        const allSelected = batch.items.length > 0 && selectedHere.length === batch.items.length;
        const batchConfirm = confirm && confirm.ids.every((id) => batch.items.some((item) => item.id === id)) ? confirm : null;

        return (
          <article key={batch.id} className="hf-panel">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="hf-type-body-lg hf-type-strong text-hf-black">Parti {formatTimestamp(batch.createdAt)}</h3>
                <p className="hf-type-body text-text-secondary">
                  {batch.items.length} {batch.items.length === 1 ? "fil" : "filer"} · <span className="text-hf-green-dark">{count("APPLIED")} lagt op</span>
                  {count("CONFLICT") > 0 && <span className="text-hf-warning"> · {count("CONFLICT")} venter på svar</span>}
                  {count("IGNORED") > 0 && <span> · {count("IGNORED")} ignoreret</span>}
                  {count("REJECTED") > 0 && <span className="text-hf-red-dark"> · {count("REJECTED")} afvist</span>}
                  {count("FAILED") > 0 && <span className="text-hf-red-dark"> · {count("FAILED")} fejlede</span>}
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
                          text: `Slet ${selectedHere.length} valgte ${selectedHere.length === 1 ? "upload" : "uploads"}?`,
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
                    {batchConfirm.text} Filerne fjernes, og varer, der fik billede herfra, får det tidligere billede tilbage.
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
              <table className="w-full min-w-[64rem] border-collapse text-left">
                <thead>
                  <tr className="hf-type-small border-b border-hf-tan-dark text-text-muted">
                    {canEdit && <th className="w-8 py-2 pr-2" aria-label="Vælg" />}
                    <th className="w-20 py-2 pr-3">Billede</th>
                    <th className="py-2 pr-3">Fil og vare</th>
                    <th className="py-2 pr-3">Rolle</th>
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
                          <CheckerThumb src={item.imageUrl} alt={item.fileName} />
                        </td>
                        <td className="py-2 pr-3">
                          <p className="hf-type-body hf-type-strong break-words text-hf-black">{item.fileName}</p>
                          <p className="hf-type-small text-text-muted">{formatClock(item.createdAt)}</p>
                          {targetsLabel(item.targets) && <p className="hf-type-body text-hf-green-dark">→ {targetsLabel(item.targets)}</p>}
                        </td>
                        <td className="hf-type-body py-2 pr-3 text-hf-black">{item.role ? ROLE_LABEL[item.role] : "–"}</td>
                        <td className="py-2 pr-3">
                          <p className="hf-type-body text-hf-black">{formatDimensions(item.width, item.height)}</p>
                          {item.hasAlpha && <p className="hf-type-small text-text-muted">fritlagt</p>}
                        </td>
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
                          <td colSpan={canEdit ? 9 : 8} className="p-3">
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

function StatusText({ item }: { item: ProductImageUploadItem }) {
  switch (item.status) {
    case "APPLIED": {
      const replaced = item.targets.some((target) => target.replacedUrl);
      return <p className="hf-type-body text-hf-green-dark">{replaced ? "Lagt op — erstattede et billede" : "Lagt op"}</p>;
    }
    case "CONFLICT":
      return <p className="hf-type-body text-hf-warning">Findes allerede — venter på svar</p>;
    case "IGNORED":
      return <p className="hf-type-body text-text-muted">Ignoreret</p>;
    case "REJECTED":
      return (
        <div>
          <p className="hf-type-body text-hf-red-dark">Afvist</p>
          {item.message && <p className="hf-type-small text-hf-red-dark">{item.message}</p>}
        </div>
      );
    default:
      return (
        <div>
          <p className="hf-type-body text-hf-red-dark">Fejlede</p>
          {item.message && <p className="hf-type-small text-hf-red-dark">{item.message}</p>}
        </div>
      );
  }
}
