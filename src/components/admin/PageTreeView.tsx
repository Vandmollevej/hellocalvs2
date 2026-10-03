"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  IconCaretRightFilled,
  IconCheck,
  IconChevronDown,
  IconExternalLink,
  IconSearch,
} from "@tabler/icons-react";
import { flattenPageTree, isDynamicPath, type PageArea, type PageNode } from "@/lib/page-tree";

// Flueben for "testet" gemmes kun i denne browser (en bekvemmelighed for
// admin under test, ikke data der skal deles).
const STORAGE_KEY = "hello-cal-admin-page-tree-tested";

const CHANGE_EVENT = "hello-cal-page-tree-tested";
// Bruges hvis localStorage ikke kan skrives (privat vindue o.l.) — så gælder
// fluebenene kun indtil siden lukkes.
let memoryFallback = "[]";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function parseTested(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeTested(paths: Set<string>) {
  memoryFallback = JSON.stringify([...paths]);
  try {
    window.localStorage.setItem(STORAGE_KEY, memoryFallback);
  } catch {
    // Se memoryFallback.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function matches(node: PageNode, query: string): boolean {
  return (
    node.label.toLowerCase().includes(query) ||
    node.path.toLowerCase().includes(query) ||
    (node.note?.toLowerCase().includes(query) ?? false)
  );
}

// Beholder en side, hvis den selv eller en underside matcher søgningen.
function filterNodes(nodes: PageNode[], query: string): PageNode[] {
  if (!query) return nodes;
  const result: PageNode[] = [];
  for (const node of nodes) {
    const children = node.children ? filterNodes(node.children, query) : [];
    if (matches(node, query) || children.length > 0) {
      result.push({ ...node, children: matches(node, query) ? node.children : children });
    }
  }
  return result;
}

function countNodes(nodes: PageNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);
}

export function PageTreeView({ areas }: { areas: PageArea[] }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const testedRaw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const tested = useMemo(() => parseTested(testedRaw), [testedRaw]);

  const total = useMemo(() => flattenPageTree(areas).length, [areas]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleAreas = useMemo(
    () =>
      areas
        .map((area) => ({ ...area, pages: filterNodes(area.pages, normalizedQuery) }))
        .filter((area) => area.pages.length > 0),
    [areas, normalizedQuery]
  );

  function toggleTested(path: string) {
    const next = new Set(tested);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    writeTested(next);
  }

  function resetTested() {
    if (!window.confirm("Fjern alle flueben for testede sider?")) return;
    writeTested(new Set());
  }

  function toggleArea(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const testedCount = flattenPageTree(areas).filter((node) => tested.has(node.path)).length;
  const progress = total > 0 ? Math.round((testedCount / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 hf-surface p-4">
        <div className="hf-type-body flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="hf-type-strong text-hf-black">{total} sider</span>
          <span className="text-text-secondary">
            {testedCount} testet ({progress}%)
          </span>
          <button
            type="button"
            onClick={resetTested}
            disabled={testedCount === 0}
            className="hf-type-small ml-auto rounded-md border border-hf-tan-dark px-2.5 py-1 text-text-secondary hover:bg-hf-tan disabled:opacity-40"
          >
            Nulstil flueben
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-hf-tan">
          <div className="h-full rounded-full bg-hf-green-dark transition-all" style={{ width: `${progress}%` }} />
        </div>
        <label className="flex items-center gap-2 rounded-md border border-hf-tan-dark bg-page-bg px-3 py-2">
          <IconSearch size={16} className="shrink-0 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg efter side eller adresse, fx “vægt” eller /settings"
            className="hf-type-body w-full bg-transparent text-hf-black outline-none placeholder:text-text-muted"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <a
              key={area.id}
              href={`#area-${area.id}`}
              className="hf-type-small rounded-full border border-hf-tan-dark px-3 py-1 text-text-secondary hover:bg-hf-tan"
            >
              {area.title}
            </a>
          ))}
        </div>
        <Legend />
      </div>

      {visibleAreas.length === 0 && <p className="hf-type-body text-text-muted">Ingen sider matcher “{query}”.</p>}

      {visibleAreas.map((area) => {
        const isCollapsed = collapsed.has(area.id) && !normalizedQuery;
        return (
          <section
            key={area.id}
            id={`area-${area.id}`}
            className="scroll-mt-4 rounded-xl border border-hf-tan-dark bg-hf-cream"
          >
            <button
              type="button"
              onClick={() => toggleArea(area.id)}
              className="flex w-full items-center gap-3 rounded-t-xl border-b border-hf-tan-dark bg-hf-green-dark px-4 py-3 text-left text-hf-white"
            >
              <span className="flex-1">
                <span className="hf-type-strong block">{area.title}</span>
                <span className="hf-type-small text-text-secondary block">{area.description}</span>
              </span>
              <span className="hf-type-small rounded-full bg-hf-white/20 px-2 py-0.5">{countNodes(area.pages)}</span>
              <IconChevronDown size={18} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
            </button>
            {!isCollapsed && (
              <div className="overflow-x-auto p-4">
                <ul className="flex flex-col gap-3">
                  {area.pages.map((node) => (
                    <li key={node.path}>
                      <TreeNode node={node} tested={tested} onToggle={toggleTested} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TreeNode({
  node,
  tested,
  onToggle,
}: {
  node: PageNode;
  tested: Set<string>;
  onToggle: (path: string) => void;
}) {
  const children = node.children ?? [];
  return (
    <div>
      <PageCard node={node} isTested={tested.has(node.path)} onToggle={onToggle} />
      {children.length > 0 && (
        <ul className="ml-5 mt-2 flex flex-col gap-2">
          {children.map((child, index) => (
            <li key={child.path} className="relative pl-8">
              {/* Lodret linje fra forælderen; stopper ved sidste barn. */}
              <span
                aria-hidden
                className={`absolute left-0 w-0 border-l-2 border-hf-tan-dark ${
                  index === children.length - 1 ? "-top-2 h-[calc(1.25rem+0.5rem)]" : "-top-2 bottom-0"
                }`}
              />
              {/* Vandret pil ind til undersiden. */}
              <span aria-hidden className="absolute left-0 top-5 w-6 border-t-2 border-hf-tan-dark" />
              <IconCaretRightFilled
                aria-hidden
                size={14}
                className="absolute left-[18px] top-5 -translate-y-1/2 text-hf-tan-dark"
              />
              <TreeNode node={child} tested={tested} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageCard({
  node,
  isTested,
  onToggle,
}: {
  node: PageNode;
  isTested: boolean;
  onToggle: (path: string) => void;
}) {
  const dynamic = isDynamicPath(node.path);
  const body = (
    <>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="hf-type-strong text-hf-black">{node.label}</span>
        {dynamic ? (
          <span className="hf-type-micro rounded-full bg-hf-warning-fill px-2 py-0.5 text-text-secondary">
            kræver id — åbnes inde fra appen
          </span>
        ) : (
          <IconExternalLink size={14} className="text-text-muted" />
        )}
      </span>
      <span className="hf-type-small block font-mono text-text-muted">{node.path}</span>
      {node.note && <span className="hf-type-small block italic text-text-secondary">{node.note}</span>}
    </>
  );

  return (
    <div
      className={`inline-flex min-h-10 min-w-64 max-w-full items-center gap-3 rounded-lg border px-3 py-2 shadow-sm ${
        isTested ? "border-hf-green bg-hf-green-light/40" : "border-hf-tan-dark bg-page-bg"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(node.path)}
        aria-pressed={isTested}
        aria-label={isTested ? `Fjern flueben for ${node.label}` : `Markér ${node.label} som testet`}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          isTested ? "border-hf-green-dark bg-hf-green-dark text-hf-white" : "border-hf-tan-dark bg-hf-white"
        }`}
      >
        {isTested && <IconCheck size={14} stroke={3} />}
      </button>
      {dynamic ? (
        <span className="min-w-0 flex-1">{body}</span>
      ) : (
        <a
          href={node.path}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 rounded hover:underline hover:decoration-text-muted"
        >
          {body}
        </a>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="hf-type-small flex flex-wrap items-center gap-x-5 gap-y-1 text-text-muted">
      <span className="flex items-center gap-1">
        <span className="h-0 w-5 border-t-2 border-hf-tan-dark" />
        <IconCaretRightFilled size={12} className="-ml-1.5 text-hf-tan-dark" />
        fører videre til underside
      </span>
      <span className="flex items-center gap-1">
        <IconExternalLink size={12} /> åbner i ny fane
      </span>
      <span className="flex items-center gap-1">
        <span className="rounded-full bg-hf-warning-fill px-1.5">kræver id</span> kan kun åbnes inde fra appen
      </span>
    </div>
  );
}
