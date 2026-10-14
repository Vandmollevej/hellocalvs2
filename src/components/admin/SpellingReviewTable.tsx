"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applySpellingAction, loadSpellingIssues, type SpellingAction } from "@/app/admin/spelling/actions";
import { ListModeToggle, ListPager, LoadMoreSentinel, useListMode } from "@/components/admin/ListMode";
import { SPELLING_PAGE_SIZE, type SpellingIssueRow, type SpellingTabKey } from "@/lib/spelling-issues-types";

// Tabellen på admin → Stavekontrol (docs/DECISIONS.md 2026-10-14, brugerens
// krav): flueben pr. række, dropdown øverst ("Accepter rettelser" …), den
// oprindelige sammenhæng med ordet fremhævet, robottens forslag ved siden af
// og et felt til admins egen rettelse. Egen rettelse vinder over forslaget og
// vælger rækken af sig selv.

const REASON_LABELS: Record<string, string> = {
  learned: "Lært af admin",
  look_alike: "Forvekslede tegn",
  allergen: "Allergen (STORE bogstaver)",
  junk: "Volapyk",
  e_number: "E-nummer",
  nutrition: "Næringstabel i listen",
  unknown: "Ukendt ord (kun i denne vare)",
};

const ACTIONS: Record<SpellingTabKey, { key: SpellingAction; label: string }[]> = {
  pending: [
    { key: "accept", label: "Accepter rettelser" },
    { key: "reject", label: "Afvis — ordet er rigtigt" },
  ],
  auto: [
    { key: "revert", label: "Fortryd rettelser" },
    { key: "accept", label: "Accepter min rettelse" },
  ],
  accepted: [
    { key: "revert", label: "Fortryd rettelser" },
    { key: "accept", label: "Accepter min rettelse" },
  ],
  rejected: [{ key: "accept", label: "Accepter rettelser" }],
};

function Suggestion({ row }: { row: SpellingIssueRow }) {
  const value = row.status === "AUTO_FIXED" || row.status === "ACCEPTED" ? row.appliedText : row.suggestion;
  if (value === null || value === undefined) return <span className="text-text-muted">–</span>;
  if (value === "") return <span className="hf-type-strong text-hf-red-dark">Slet</span>;
  return <mark className="rounded bg-hf-green-muted px-0.5 hf-type-strong text-hf-green-dark">{value}</mark>;
}

export function SpellingReviewTable({
  tab,
  total,
  initialRows,
  canEdit,
}: {
  tab: SpellingTabKey;
  total: number;
  initialRows: SpellingIssueRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode] = useListMode();
  const [rows, setRows] = useState(initialRows);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownTexts, setOwnTexts] = useState<Record<string, string>>({});
  const actions = ACTIONS[tab];
  const [action, setAction] = useState<SpellingAction>(actions[0].key);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const pages = Math.max(1, Math.ceil(total / SPELLING_PAGE_SIZE));
  const visible = mode === "pages" && page === 1 ? rows.slice(0, SPELLING_PAGE_SIZE) : rows;
  const allSelected = visible.length > 0 && visible.every((row) => selected.has(row.id));

  async function load(offset: number, append: boolean) {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await loadSpellingIssues(tab, offset);
      setRows((current) => (append ? [...current, ...next.filter((row) => !current.some((item) => item.id === row.id))] : next));
    } catch {
      setLoadError("Kunne ikke hente flere rækker");
    } finally {
      setLoading(false);
    }
  }

  function goToPage(next: number) {
    setPage(next);
    void load((next - 1) * SPELLING_PAGE_SIZE, false);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((row) => row.id)));
  }

  function setOwnText(id: string, text: string) {
    setOwnTexts((current) => ({ ...current, [id]: text }));
    if (text.trim()) setSelected((current) => (current.has(id) ? current : new Set(current).add(id)));
  }

  function run() {
    const ids = [...selected];
    if (!ids.length) {
      setNotice({ ok: false, text: "Sæt flueben ved mindst én række" });
      return;
    }
    const texts = Object.fromEntries(ids.filter((id) => ownTexts[id]?.trim()).map((id) => [id, ownTexts[id].trim()]));
    startTransition(async () => {
      const result = await applySpellingAction(action, ids, texts);
      setNotice({ ok: result.ok, text: result.message });
      const failed = new Set(result.failedIds);
      // Færdige rækker forsvinder fra fanen; fejlede bliver stående og valgt.
      setRows((current) => current.filter((row) => !selected.has(row.id) || failed.has(row.id)));
      setSelected(failed);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <ListModeToggle summary={`Viser ${visible.length} af ${total}`} />

      {canEdit && rows.length > 0 && (
        <div className="hf-surface flex flex-wrap items-center gap-2 p-3">
          <span className="hf-type-body text-hf-black">{selected.size} valgt</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as SpellingAction)}
            aria-label="Handling"
            className="hf-input hf-input--compact w-auto"
          >
            {actions.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={run} disabled={pending || selected.size === 0} className="hf-btn-primary hf-btn--compact hf-btn--inline">
            {pending ? "Udfører…" : "Udfør"}
          </button>
          {notice && (
            <p role="status" className={`hf-type-small ${notice.ok ? "text-hf-green-dark" : "text-hf-red-dark"}`}>
              {notice.text}
            </p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="hf-panel hf-type-body text-text-secondary">Ingen rækker her.</p>
      ) : (
        <div className="hf-surface hf-table-scroll">
          <table className="w-full min-w-[64rem] border-collapse text-left">
            <thead>
              <tr className="hf-type-small border-b border-hf-tan-dark text-text-muted">
                {canEdit && (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Vælg alle viste"
                      className="hf-native-choice h-4 w-4 accent-hf-green-dark"
                    />
                  </th>
                )}
                <th className="py-2 pr-3">Vare</th>
                <th className="py-2 pr-3">Original sammenhæng</th>
                <th className="py-2 pr-3">Forslag</th>
                {canEdit && <th className="py-2 pr-3">Min rettelse</th>}
                <th className="py-2 pr-3">Sikkerhed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-hf-tan align-top">
                  {canEdit && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Vælg ${row.word}`}
                        className="hf-native-choice mt-1 h-4 w-4 accent-hf-green-dark"
                      />
                    </td>
                  )}
                  <td className="hf-type-body max-w-[14rem] py-2 pr-3">
                    <Link href={`/admin/products/${row.productId}`} className="break-words text-hf-green-dark underline">
                      {row.productName}
                    </Link>
                  </td>
                  <td className="hf-type-body max-w-[28rem] py-2 pr-3 text-hf-black">
                    <span className="break-words">
                      {row.contextBefore}
                      <mark className="rounded bg-hf-warning-bg px-0.5 hf-type-strong text-hf-red-dark">{row.word}</mark>
                      {row.contextAfter}
                    </span>
                  </td>
                  <td className="hf-type-body py-2 pr-3">
                    <Suggestion row={row} />
                  </td>
                  {canEdit && (
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={ownTexts[row.id] ?? ""}
                        onChange={(event) => setOwnText(row.id, event.target.value)}
                        placeholder="Skriv rettelse"
                        aria-label={`Min rettelse af ${row.word}`}
                        className="hf-input hf-input--compact w-44"
                      />
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <p className="hf-type-body text-hf-black">{Math.round(row.confidence * 100)} %</p>
                    <p className="hf-type-small text-text-muted">{REASON_LABELS[row.reason] ?? row.reason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "scroll" && rows.length < total && (
        <LoadMoreSentinel onVisible={() => void load(rows.length, true)} loading={loading} error={loadError} />
      )}
      {mode === "pages" && <ListPager page={page} pages={pages} onPage={goToPage} busy={loading} />}
    </section>
  );
}
