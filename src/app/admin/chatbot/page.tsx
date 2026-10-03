import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import {
  CHATBOT_ADMIN_PERIODS,
  chatbotCategoryStats,
  listChatbotConversations,
  listChatbotQuestions,
  parseChatbotAdminFilter,
  type ChatbotAdminFilter,
} from "@/lib/chatbot";
import { CHATBOT_CATEGORIES, chatbotCategoryLabel } from "@/lib/chatbot-categories";
import { ageLabel, regionLabel, sexLabel, tierLabel } from "@/lib/chatbot-admin-labels";
import { formatAdminTime } from "@/lib/support-labels";
import { supportCaseCode } from "@/lib/support-inbox";
import { ChatbotThreadMessages } from "@/components/admin/chatbot/ChatbotThreadMessages";

// Admin → Brugere → Chatbot (docs/DECISIONS.md 2026-10-02): oftest spurgte
// kategorier, alle spørgsmål med chatbottens svar, hele tråde og info om
// brugeren (øjebliksbillede fra samtalens start: alder, køn, region,
// abonnement). Filteret ligger i URL'en.
const PERIOD_LABELS: Record<string, string> = { "7": "7 dage", "30": "30 dage", "90": "90 dage", all: "Altid" };

function hrefFor(filter: ChatbotAdminFilter, next: Partial<ChatbotAdminFilter>) {
  const merged = { ...filter, page: 1, ...next };
  const params = new URLSearchParams();
  if (merged.view !== "questions") params.set("view", merged.view);
  if (merged.period !== "30") params.set("period", merged.period);
  if (merged.category) params.set("category", merged.category);
  if (merged.q) params.set("q", merged.q);
  if (merged.escalated) params.set("escalated", "1");
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `/admin/chatbot?${query}` : "/admin/chatbot";
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export default async function AdminChatbotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filter = parseChatbotAdminFilter(await searchParams);
  const stats = await chatbotCategoryStats(filter.period);
  const maxCount = stats.rows[0]?.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Chatbot</h1>
        <p className="hf-type-body text-text-secondary">
          Spørgsmål til hjælpe-chatbotten i appen og på web. Brugerinfo er fra samtalens start.
        </p>
      </div>

      <nav aria-label="Periode" className="flex flex-wrap gap-2">
        {CHATBOT_ADMIN_PERIODS.map((period) => (
          <Link
            key={period}
            href={hrefFor(filter, { period })}
            aria-current={filter.period === period ? "true" : undefined}
            className={`hf-type-small rounded-md border px-3 py-1.5 ${
              filter.period === period
                ? "hf-type-strong border-hf-green bg-hf-tan text-hf-green-dark"
                : "border-hf-tan-dark bg-hf-white text-text-secondary hover:bg-hf-tan"
            }`}
          >
            {PERIOD_LABELS[period]}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Spørgsmål" value={stats.totalQuestions} />
        <Kpi label="Samtaler" value={stats.conversations} />
        <Kpi label="Sendt til medarbejder" value={stats.escalated} />
        <Kpi label="Andel sendt videre" value={`${percent(stats.escalated, stats.conversations)} %`} />
      </dl>

      <section className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <h2 className="hf-type-title text-hf-black">Oftest spurgt</h2>
        {stats.rows.length === 0 ? (
          <p className="hf-type-body text-text-secondary">Ingen spørgsmål i perioden.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.rows.map((row) => (
              <li key={row.category}>
                <Link
                  href={hrefFor(filter, { category: filter.category === row.category ? null : row.category })}
                  className={`grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 rounded-md px-2 py-1 hover:bg-hf-tan ${
                    filter.category === row.category ? "bg-hf-tan" : ""
                  }`}
                >
                  <span className="hf-type-body truncate text-hf-black">{chatbotCategoryLabel(row.category)}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-hf-tan" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-hf-green"
                      style={{ width: `${maxCount ? Math.max(4, (row.count / maxCount) * 100) : 0}%` }}
                    />
                  </span>
                  <span className="hf-type-small tabular-nums text-text-secondary">
                    {row.count} · {percent(row.count, stats.totalQuestions)} %
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex overflow-hidden rounded-md border border-hf-tan-dark" role="tablist">
            {(
              [
                ["questions", "Spørgsmål og svar"],
                ["threads", "Hele tråde"],
              ] as const
            ).map(([view, label]) => (
              <Link
                key={view}
                href={hrefFor(filter, { view })}
                role="tab"
                aria-selected={filter.view === view}
                className={`hf-type-small px-3 py-1.5 ${
                  filter.view === view ? "hf-type-strong bg-hf-green-dark text-hf-white" : "bg-hf-white text-text-secondary hover:bg-hf-tan"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <form method="get" action="/admin/chatbot" className="hf-type-small flex flex-wrap items-end gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-3">
          {filter.view !== "questions" && <input type="hidden" name="view" value={filter.view} />}
          {filter.period !== "30" && <input type="hidden" name="period" value={filter.period} />}
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="text-text-secondary">Søg i spørgsmål</span>
            <input
              type="search"
              name="q"
              defaultValue={filter.q}
              placeholder="Fx abonnement"
              className="hf-type-body h-9 rounded-md border border-hf-tan-dark bg-hf-white px-2 outline-none focus:border-hf-green"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">Kategori</span>
            <select
              name="category"
              defaultValue={filter.category ?? ""}
              className="hf-type-body h-9 rounded-md border border-hf-tan-dark bg-hf-white px-2"
            >
              <option value="">Alle kategorier</option>
              {CHATBOT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {chatbotCategoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2">
            <input type="checkbox" name="escalated" value="1" defaultChecked={filter.escalated} />
            <span>Kun sendt til medarbejder</span>
          </label>
          <button type="submit" className="hf-type-small hf-type-strong h-9 rounded-md bg-hf-green-dark px-3 text-hf-white">
            Filtrér
          </button>
          {(filter.q || filter.category || filter.escalated) && (
            <Link href={hrefFor(filter, { q: "", category: null, escalated: false })} className="flex h-9 items-center px-2 text-text-secondary underline">
              Nulstil
            </Link>
          )}
        </form>

        {filter.view === "questions" ? <QuestionsTable filter={filter} /> : <ThreadsList filter={filter} />}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-3">
      <dt className="hf-type-small text-text-secondary">{label}</dt>
      <dd className="hf-type-page-title tabular-nums text-hf-black">{value}</dd>
    </div>
  );
}

function UserCell({
  user,
  age,
  sex,
  region,
  tier,
  plan,
}: {
  user: { displayName: string; email: string };
  age: number | null;
  sex?: string | null;
  region: string;
  tier: string;
  plan?: string | null;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-hf-black">{user.displayName}</span>
      <span className="hf-type-small text-text-muted">{user.email}</span>
      <span className="hf-type-small text-text-secondary">
        {[ageLabel(age), sex !== undefined ? sexLabel(sex) : null, regionLabel(region), tierLabel(tier, plan)]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}

function Pager({ filter, pages, total, noun }: { filter: ChatbotAdminFilter; pages: number; total: number; noun: string }) {
  if (pages <= 1) return <p className="hf-type-small text-text-muted">{total} {noun}</p>;
  return (
    <div className="hf-type-small flex items-center justify-between gap-2 text-text-secondary">
      <span>
        {total} {noun} · side {filter.page} af {pages}
      </span>
      <span className="flex gap-3">
        {filter.page > 1 && (
          <Link className="underline" href={hrefFor(filter, { page: filter.page - 1 })}>
            Forrige
          </Link>
        )}
        {filter.page < pages && (
          <Link className="underline" href={hrefFor(filter, { page: filter.page + 1 })}>
            Næste
          </Link>
        )}
      </span>
    </div>
  );
}

async function QuestionsTable({ filter }: { filter: ChatbotAdminFilter }) {
  const { rows, total, pages } = await listChatbotQuestions(filter);
  if (rows.length === 0) return <p className="hf-type-body py-4 text-text-secondary">Ingen spørgsmål matcher filteret.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-hf-tan-dark bg-hf-white">
        <table className="hf-type-body w-full min-w-[56rem] text-left align-top">
          <thead>
            <tr className="hf-type-small border-b border-hf-tan-dark uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2">Tid</th>
              <th className="px-3 py-2">Kategori</th>
              <th className="px-3 py-2">Spørgsmål</th>
              <th className="px-3 py-2">Svar</th>
              <th className="px-3 py-2">Bruger</th>
              <th className="px-3 py-2">Tråd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-hf-tan-dark align-top last:border-b-0">
                <td className="hf-type-small whitespace-nowrap px-3 py-2 text-text-secondary">{formatAdminTime(row.createdAt)}</td>
                <td className="hf-type-small whitespace-nowrap px-3 py-2">{chatbotCategoryLabel(row.category)}</td>
                <td className="max-w-xs whitespace-pre-wrap px-3 py-2 text-hf-black">{row.body}</td>
                <td className="max-w-md whitespace-pre-wrap px-3 py-2 text-text-secondary">
                  {row.answer ? row.answer.body : <span className="text-text-muted">Intet svar</span>}
                  {row.answer?.needsHuman && <span className="hf-type-small block text-hf-warning">Foreslog medarbejder</span>}
                </td>
                <td className="px-3 py-2">
                  <UserCell
                    user={row.conversation.user}
                    age={row.conversation.userAgeSnapshot}
                    region={row.conversation.userRegionSnapshot}
                    tier={row.conversation.userTierSnapshot}
                  />
                </td>
                <td className="hf-type-small whitespace-nowrap px-3 py-2">
                  <Link href={`/admin/chatbot/${row.conversationId}`} className="underline">
                    Se tråd
                  </Link>
                  {row.conversation.escalatedAt && <span className="block text-hf-green-dark">Sendt videre</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager filter={filter} pages={pages} total={total} noun="spørgsmål" />
    </div>
  );
}

async function ThreadsList({ filter }: { filter: ChatbotAdminFilter }) {
  const { conversations, total, pages } = await listChatbotConversations(filter);
  if (conversations.length === 0) return <p className="hf-type-body py-4 text-text-secondary">Ingen tråde matcher filteret.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <UserCell
                user={conversation.user}
                age={conversation.userAgeSnapshot}
                sex={conversation.userSexSnapshot}
                region={conversation.userRegionSnapshot}
                tier={conversation.userTierSnapshot}
                plan={conversation.userPlanSnapshot}
              />
              <div className="hf-type-small flex flex-col items-end gap-0.5 text-text-secondary">
                <span>{chatbotCategoryLabel(conversation.category)}</span>
                <span>
                  {conversation.questionCount} spørgsmål · {formatAdminTime(conversation.createdAt)}
                </span>
                {conversation.supportRequestId && (
                  <Link href={`/admin/support/${conversation.supportRequestId}`} className="text-hf-green-dark underline">
                    Supportsag #{supportCaseCode(conversation.supportRequestId)}
                  </Link>
                )}
                <Link href={`/admin/chatbot/${conversation.id}`} className="underline">
                  Åbn tråd
                </Link>
              </div>
            </div>
            <ChatbotThreadMessages messages={conversation.messages} />
          </li>
        ))}
      </ul>
      <Pager filter={filter} pages={pages} total={total} noun="tråde" />
    </div>
  );
}
