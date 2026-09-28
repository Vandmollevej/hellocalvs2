import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { isDebugLogEnabled } from "@/lib/debug-log";
import {
  OUTCOME_LABELS,
  eventLabel,
  formatDuration,
  formatTime,
  summarizeFlows,
  type DebugLogRow,
  type FlowSummary,
} from "@/lib/debug-log-view";
import { DebugLogControls } from "@/components/admin/DebugLogControls";

// Admin "Log" (docs/DECISIONS.md 2026-09-28): test-log indtil appen går live.
// Scanninger viser hvert kameraflow som én tidslinje (telefonens og
// serverens trin + OpenAI-kaldene); de øvrige faner viser AI-kald, cron,
// fejl og de logs appen i forvejen gemmer (logins, mails/push,
// admin-handlinger, søgninger uden resultat).
export const dynamic = "force-dynamic";

const TABS = [
  { key: "scan", label: "Scanninger" },
  { key: "ai", label: "AI-kald" },
  { key: "cron", label: "Cron" },
  { key: "errors", label: "Fejl" },
  { key: "logins", label: "Logins" },
  { key: "messages", label: "Mails og push" },
  { key: "audit", label: "Admin-handlinger" },
  { key: "search", label: "Søgninger uden resultat" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const LIST_LIMIT = 300;
const FLOW_ROW_LIMIT = 4000;
const FLOW_LIMIT = 80;

function levelDot(level: string) {
  if (level === "error") return "bg-hf-red-dark";
  if (level === "warn") return "bg-hf-warning";
  return "bg-hf-green";
}

function JsonDetails({ data }: { data: unknown }) {
  if (data == null) return null;
  return (
    <details className="mt-1">
      <summary className="hf-type-small cursor-pointer text-text-muted">Detaljer</summary>
      <pre className="hf-type-small mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-hf-cream p-2 text-text-secondary">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function ProductLink({ productId }: { productId: string | null }) {
  if (!productId) return null;
  return (
    <Link href={`/admin/products/${productId}`} className="hf-type-small text-hf-green-dark underline">
      Åbn vare
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="hf-type-body rounded-lg border border-hf-tan-dark bg-hf-white p-4 text-text-secondary">{text}</p>;
}

function FlowCard({ flow, email }: { flow: FlowSummary; email: string | null }) {
  const start = flow.startedAt.getTime();
  const tone =
    flow.errors > 0 ? "text-hf-red-dark" : flow.outcome === "abandoned" || flow.outcome === "open" ? "text-text-secondary" : "text-hf-green-dark";
  return (
    <details className="rounded-lg border border-hf-tan-dark bg-hf-white">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <span className="hf-type-small text-text-muted">{formatTime(flow.startedAt)}</span>
        <span className={`hf-type-body hf-type-strong ${tone}`}>{OUTCOME_LABELS[flow.outcome]}</span>
        {flow.barcode && <span className="hf-type-body text-hf-black">{flow.barcode}</span>}
        {flow.enrichmentDone === false && <span className="hf-type-small text-hf-warning">AI ikke færdig</span>}
        {flow.errors > 0 && <span className="hf-type-small text-hf-red-dark">{flow.errors} fejl</span>}
        {flow.warnings > 0 && <span className="hf-type-small text-hf-warning">{flow.warnings} advarsler</span>}
        <span className="hf-type-small text-text-muted">
          {flow.rows.length} trin · {formatDuration(flow.endedAt.getTime() - start)}
          {email ? ` · ${email}` : ""}
        </span>
        <span className="ml-auto">
          <ProductLink productId={flow.productId} />
        </span>
      </summary>
      <ol className="flex flex-col border-t border-hf-tan-dark">
        {flow.rows.map((row) => (
          <li key={row.id} className="flex gap-3 border-b border-hf-tan px-3 py-2 last:border-b-0">
            <span className="hf-type-small w-16 shrink-0 text-right text-text-muted">
              +{formatDuration(row.createdAt.getTime() - start) || "0 ms"}
            </span>
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(row.level)}`} />
            <div className="min-w-0 flex-1">
              <p className="hf-type-body text-hf-black">
                <span className="hf-type-strong">{eventLabel(row)}</span>
                {row.durationMs != null && <span className="hf-type-small text-text-muted"> · {formatDuration(row.durationMs)}</span>}
                <span className="hf-type-small text-text-muted"> · {row.category === "scan" ? "" : `${row.category} · `}{row.event}</span>
              </p>
              <p className="hf-type-small break-words text-text-secondary">{row.message}</p>
              <JsonDetails data={row.data} />
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function LogTable({ rows, emails }: { rows: DebugLogRow[]; emails: Map<string, string> }) {
  if (rows.length === 0) return <Empty text="Ingen rækker endnu." />;
  return (
    <ul className="flex flex-col rounded-lg border border-hf-tan-dark bg-hf-white">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-3 border-b border-hf-tan px-3 py-2 last:border-b-0">
          <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(row.level)}`} />
          <div className="min-w-0 flex-1">
            <p className="hf-type-body text-hf-black">
              <span className="hf-type-small text-text-muted">{formatTime(row.createdAt)} · </span>
              <span className="hf-type-strong">{eventLabel(row)}</span>
              {row.durationMs != null && <span className="hf-type-small text-text-muted"> · {formatDuration(row.durationMs)}</span>}
              {row.barcode && <span className="hf-type-small text-text-muted"> · {row.barcode}</span>}
              {row.userId && emails.get(row.userId) && (
                <span className="hf-type-small text-text-muted"> · {emails.get(row.userId)}</span>
              )}
            </p>
            <p className="hf-type-small break-words text-text-secondary">{row.message}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ProductLink productId={row.productId} />
              {row.flowId && (
                <Link href={`/admin/log?tab=scan&flow=${row.flowId}`} className="hf-type-small text-hf-green-dark underline">
                  Se scanningen
                </Link>
              )}
            </div>
            <JsonDetails data={row.data} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type SimpleRow = { id: string; time: Date; title: string; detail?: string | null; tone?: "error" | "warn" | "info" };

function SimpleList({ rows, empty }: { rows: SimpleRow[]; empty: string }) {
  if (rows.length === 0) return <Empty text={empty} />;
  return (
    <ul className="flex flex-col rounded-lg border border-hf-tan-dark bg-hf-white">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-3 border-b border-hf-tan px-3 py-2 last:border-b-0">
          <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelDot(row.tone ?? "info")}`} />
          <div className="min-w-0 flex-1">
            <p className="hf-type-body text-hf-black">
              <span className="hf-type-small text-text-muted">{formatTime(row.time)} · </span>
              {row.title}
            </p>
            {row.detail && <p className="hf-type-small break-words text-text-secondary">{row.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

async function emailsFor(userIds: (string | null)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  return new Map(users.map((user) => [user.id, user.email]));
}

// Samme 30 dage som loggens automatiske oprydning (src/lib/debug-log.ts).
function retentionStart() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

async function ScanTab({ q, flow }: { q: string; flow: string }) {
  const since = retentionStart();
  const rows = (await prisma.debugLog.findMany({
    where: flow
      ? { flowId: flow }
      : { category: { in: ["scan", "ai"] }, flowId: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: FLOW_ROW_LIMIT,
  })) as DebugLogRow[];

  let flows = summarizeFlows(rows);
  if (q) {
    const needle = q.toLowerCase();
    flows = flows.filter((item) =>
      item.rows.some(
        (row) =>
          row.barcode?.includes(needle) ||
          row.productId === q ||
          row.message.toLowerCase().includes(needle),
      ),
    );
  }
  flows = flows.slice(0, FLOW_LIMIT);

  // Scanninger uden flow-id (fx opslag fra oprettelses-appen).
  const loose = flow
    ? []
    : ((await prisma.debugLog.findMany({
        where: { category: "scan", flowId: null, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })) as DebugLogRow[]);

  const emails = await emailsFor([...flows.map((item) => item.userId), ...loose.map((row) => row.userId)]);
  const counts = {
    total: flows.length,
    created: flows.filter((item) => item.outcome === "created").length,
    existing: flows.filter((item) => item.outcome === "existing" || item.outcome === "duplicate").length,
    failed: flows.filter((item) => item.errors > 0).length,
  };

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-2" action="/admin/log">
        <input type="hidden" name="tab" value="scan" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Søg stregkode, vare-id eller tekst"
          className="hf-type-input h-10 min-w-0 flex-1 rounded-md border border-hf-tan-dark bg-hf-white px-3"
        />
        <button type="submit" className="hf-btn-secondary h-10 px-4">
          Søg
        </button>
        {(q || flow) && (
          <Link href="/admin/log?tab=scan" className="hf-btn-text flex h-10 items-center px-2">
            Vis alle
          </Link>
        )}
      </form>
      <p className="hf-type-small text-text-secondary">
        {counts.total} scanninger vist · {counts.created} nye varer · {counts.existing} kendte/dubletter · {counts.failed} med fejl. Tryk
        på en scanning for at se hvert trin med tid.
      </p>
      {flows.length === 0 ? (
        <Empty text="Ingen scanninger logget endnu. Åbn kameraet under Tilføj i appen og scan en vare." />
      ) : (
        <div className="flex flex-col gap-2">
          {flows.map((item) => (
            <FlowCard key={item.flowId} flow={item} email={item.userId ? (emails.get(item.userId) ?? null) : null} />
          ))}
        </div>
      )}
      {loose.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="hf-type-title text-hf-black">Øvrige stregkodeopslag</h2>
          <p className="hf-type-small text-text-secondary">Opslag uden kameraflow (fx fra oprettelses-appen).</p>
          <LogTable rows={loose} emails={emails} />
        </div>
      )}
    </div>
  );
}

async function DebugListTab({ where }: { where: Prisma.DebugLogWhereInput }) {
  const rows = (await prisma.debugLog.findMany({ where, orderBy: { createdAt: "desc" }, take: LIST_LIMIT })) as DebugLogRow[];
  const emails = await emailsFor(rows.map((row) => row.userId));
  return <LogTable rows={rows} emails={emails} />;
}

async function LoginsTab() {
  const rows = await prisma.loginEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, createdAt: true, method: true, country: true, user: { select: { email: true } } },
  });
  return (
    <SimpleList
      empty="Ingen logins endnu."
      rows={rows.map((row) => ({
        id: row.id,
        time: row.createdAt,
        title: `${row.user.email} · ${row.method}`,
        detail: row.country ? `Land: ${row.country}` : null,
      }))}
    />
  );
}

async function MessagesTab() {
  const rows = await prisma.outboundMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      createdAt: true,
      sentAt: true,
      channel: true,
      event: true,
      status: true,
      subject: true,
      toEmail: true,
      error: true,
      user: { select: { email: true } },
    },
  });
  return (
    <SimpleList
      empty="Ingen mails eller push-beskeder endnu."
      rows={rows.map((row) => ({
        id: row.id,
        time: row.createdAt,
        title: `${row.channel} · ${row.event} · ${row.status} · ${row.toEmail ?? row.user?.email ?? "ukendt modtager"}`,
        detail: [row.subject, row.sentAt ? `Sendt ${formatTime(row.sentAt)}` : null, row.error ? `Fejl: ${row.error}` : null]
          .filter(Boolean)
          .join(" · "),
        tone: row.error || row.status === "FAILED" ? "error" : row.status === "QUEUED" ? "warn" : "info",
      }))}
    />
  );
}

async function AuditTab() {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      createdAt: true,
      action: true,
      admin: { select: { email: true } },
      targetUser: { select: { email: true } },
    },
  });
  return (
    <SimpleList
      empty="Ingen følsomme admin-handlinger endnu."
      rows={rows.map((row) => ({
        id: row.id,
        time: row.createdAt,
        title: `${row.admin.email} · ${row.action}`,
        detail: row.targetUser ? `Bruger: ${row.targetUser.email}` : null,
        tone: "warn",
      }))}
    />
  );
}

async function SearchTab() {
  const rows = await prisma.searchMiss.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT });
  return (
    <SimpleList
      empty="Ingen søgninger uden resultat endnu."
      rows={rows.map((row) => ({ id: row.id, time: row.createdAt, title: `"${row.query}"`, detail: `Region: ${row.region}` }))}
    />
  );
}

export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; flow?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const tab: TabKey = TABS.some((item) => item.key === params.tab) ? (params.tab as TabKey) : "scan";
  const q = (params.q ?? "").trim().slice(0, 100);
  const flow = /^[A-Za-z0-9-]{8,64}$/.test(params.flow ?? "") ? (params.flow as string) : "";

  const [enabled, total] = await Promise.all([isDebugLogEnabled(), prisma.debugLog.count()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-page-title text-hf-black">Log</h1>
        <p className="hf-type-body text-text-secondary">
          Test-log indtil appen går live: hvert scannet produkt trin for trin, alle OpenAI-kald, cron-kørsler og fejl.
          Tider er dansk tid.
        </p>
      </div>

      <DebugLogControls enabled={enabled} total={total} />

      <div className="hf-type-body flex gap-4 overflow-x-auto border-b border-hf-tan-dark">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/log?tab=${item.key}`}
            className={`-mb-px shrink-0 border-b-2 pb-2 ${
              tab === item.key
                ? "hf-type-strong border-hf-green-dark text-hf-green-dark"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "scan" && <ScanTab q={q} flow={flow} />}
      {tab === "ai" && <DebugListTab where={{ category: "ai" }} />}
      {tab === "cron" && <DebugListTab where={{ category: "cron" }} />}
      {tab === "errors" && <DebugListTab where={{ level: "error" }} />}
      {tab === "logins" && <LoginsTab />}
      {tab === "messages" && <MessagesTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "search" && <SearchTab />}
    </div>
  );
}
