"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveAllImageConflicts, resolveImageConflict } from "@/app/admin/product-database/image-upload/actions";
import { formatBytes, formatClock, formatDimensions } from "@/lib/brand-logo-upload-types";
import { ROLE_LABEL, targetsLabel, type ProductImageUploadItem } from "@/lib/product-image-upload-types";
import { CheckerThumb, DiffDialog } from "@/components/admin/ImageCompare";

// «Findes allerede» (admin → Billed-upload, docs/DECISIONS.md 2026-10-04):
// billeder, hvor varen allerede har et billede. De er IKKE lagt op. For hvert:
// Ignorer (behold det nuværende), Erstat (læg det nye op; det gamle kommer
// tilbage, hvis partiet slettes) eller Vis forskel (begge billeder side om side).

const buttonClass = "hf-type-body rounded-md border border-hf-tan-dark bg-hf-white px-4 py-2 text-hf-black hover:border-hf-green disabled:opacity-60";
const primaryClass = "hf-type-body rounded-md bg-hf-green-dark px-4 py-2 text-hf-white disabled:opacity-60";

export function ProductImageConflicts({ items, canEdit }: { items: ProductImageUploadItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const dialogItem = items.find((item) => item.id === dialogId) ?? null;

  function decide(item: ProductImageUploadItem, decision: "ignore" | "replace") {
    startTransition(async () => {
      const result = await resolveImageConflict(item.id, decision);
      setNotice({
        ok: result.ok,
        text: result.ok
          ? decision === "replace"
            ? `«${item.fileName}» er lagt op i stedet for det gamle billede`
            : `«${item.fileName}» er ignoreret — det nuværende billede er beholdt`
          : result.message,
      });
      setDialogId(null);
      router.refresh();
    });
  }

  function decideAll(decision: "ignore" | "replace") {
    setConfirmAll(false);
    startTransition(async () => {
      const result = await resolveAllImageConflicts(decision);
      setNotice({ ok: result.ok, text: result.message ?? (result.ok ? "Færdig" : "Kunne ikke gennemføre") });
      router.refresh();
    });
  }

  if (items.length === 0) {
    return notice ? (
      <p className={`hf-type-body ${notice.ok ? "text-hf-green-dark" : "text-hf-red-dark"}`} role="status">
        {notice.text}
      </p>
    ) : null;
  }

  return (
    <section id="findes-allerede" className="flex scroll-mt-4 flex-col gap-3 rounded-lg border-2 border-hf-warning bg-hf-warning-bg p-4" aria-busy={pending}>
      <div className="flex flex-col gap-1">
        <h2 className="hf-type-card-title text-hf-black">Findes allerede ({items.length})</h2>
        <p className="hf-type-body text-text-secondary">
          Disse varer har allerede et billede, så de nye er <span className="hf-type-strong">ikke</span> lagt op. Vælg for hvert billede — eller for alle på én gang.
        </p>
      </div>

      {notice && (
        <p className={`hf-type-body ${notice.ok ? "text-hf-green-dark" : "text-hf-red-dark"}`} role="status">
          {notice.text}
        </p>
      )}

      {canEdit && items.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => decideAll("ignore")}>
              Ignorer alle ({items.length})
            </button>
            <button type="button" className={primaryClass} disabled={pending} onClick={() => setConfirmAll(true)}>
              Erstat alle ({items.length})
            </button>
          </div>
          {confirmAll && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-hf-red-dark bg-hf-red-muted p-3" role="alertdialog">
              <p className="hf-type-body min-w-0 flex-1 text-hf-black">
                Erstat de nuværende billeder på alle {items.length} varer? De gamle kommer tilbage, hvis du sletter partiet bagefter.
              </p>
              <button type="button" className={primaryClass} disabled={pending} onClick={() => decideAll("replace")}>
                Ja, erstat alle
              </button>
              <button type="button" className={buttonClass} onClick={() => setConfirmAll(false)}>
                Annullér
              </button>
            </div>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const conflicting = item.targets.filter((target) => target.existingUrl);
          return (
            <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-3">
              <div className="flex flex-wrap items-start gap-4">
                <figure className="flex flex-col items-center gap-1">
                  <CheckerThumb src={conflicting[0]?.existingUrl ?? null} alt="Nuværende billede" className="h-28 w-28" />
                  <figcaption className="hf-type-small text-text-muted">Nuværende</figcaption>
                </figure>
                <figure className="flex flex-col items-center gap-1">
                  <CheckerThumb src={item.imageUrl} alt="Nyt billede" className="h-28 w-28" />
                  <figcaption className="hf-type-small text-text-muted">Nyt{item.hasAlpha ? " (fritlagt)" : ""}</figcaption>
                </figure>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="hf-type-body hf-type-strong break-words text-hf-black">{item.fileName}</p>
                  <p className="hf-type-body text-text-secondary">
                    {item.role ? ROLE_LABEL[item.role] : "Billede"} → {targetsLabel(item.targets) ?? "varen"}
                    {conflicting.length > 1 && ` (${conflicting.length} har allerede et billede)`}
                  </p>
                  <p className="hf-type-small text-text-muted">
                    Nyt: {formatDimensions(item.width, item.height)} · {formatBytes(item.bytes)}
                    {item.originalBytes ? ` (original ${formatDimensions(item.originalWidth, item.originalHeight)}, ${formatBytes(item.originalBytes)})` : ""} · uploadet {formatClock(item.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <>
                    <button type="button" className={buttonClass} disabled={pending} onClick={() => decide(item, "ignore")}>
                      Ignorer
                    </button>
                    <button type="button" className={primaryClass} disabled={pending} onClick={() => decide(item, "replace")}>
                      Erstat
                    </button>
                  </>
                )}
                <button type="button" className={buttonClass} onClick={() => setDialogId(item.id)}>
                  Vis forskel
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {dialogItem && (
        <DiffDialog
          item={dialogItem}
          canEdit={canEdit}
          pending={pending}
          onDecide={(decision) => decide(dialogItem, decision)}
          onClose={() => setDialogId(null)}
        />
      )}
    </section>
  );
}
