import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { t } from "@/lib/admin-i18n";
import {
  countSupportInbox,
  isSupportOverdue,
  listSupportInbox,
  parseSupportInboxFilter,
  supportCaseCode,
} from "@/lib/support-inbox";
import { SUPPORT_CATEGORY_LABELS, SUPPORT_PRIORITY_LABELS, formatAdminTime, formatWaiting } from "@/lib/support-labels";
import { PriorityDot, SupportInboxFilters } from "@/components/admin/SupportInboxFilters";

// Admin "Support" — beskedtjeneste (docs/DECISIONS.md 2026-09-23 og
// 2026-09-26 "Support-indbakke"): henvendelser fra "Kontakt os" som tråde.
// Standard: åbne sager, ældste øverst. Ubesvarede sager markeres, og sager
// uden svar i over 24 timer fremhæves (admin får også en mail).
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const filter = parseSupportInboxFilter(await searchParams);
  const [requests, counts] = await Promise.all([listSupportInbox(filter), countSupportInbox()]);
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="hf-type-title text-text-primary">{t(admin.locale, "support_title")}</h1>
          <Link href="/admin/support/templates" className="hf-type-small text-text-secondary underline hover:text-text-primary">
            Svarskabeloner
          </Link>
        </div>
        <p className="hf-type-body text-text-secondary">
          {counts.unanswered} ikke besvaret
          {counts.overdue > 0 && (
            <span className="hf-type-strong text-hf-red-dark"> · {counts.overdue} over 24 timer</span>
          )}
        </p>
      </div>

      <SupportInboxFilters filter={filter} />

      {requests.length === 0 && <p className="hf-type-body py-4 text-text-secondary">Ingen henvendelser matcher filteret.</p>}

      <ul className="flex flex-col gap-2">
        {requests.map((request) => {
          const unanswered = request.status === "OPEN" && request.awaitingReply;
          const overdue = isSupportOverdue(request, now);
          return (
            <li key={request.id}>
              <Link
                href={`/admin/support/${request.id}`}
                className={`block rounded-lg border bg-surface-2 p-3 hover:bg-hf-tan ${
                  overdue
                    ? "border-hf-red-dark border-l-4"
                    : unanswered
                      ? "border-border-strong border-l-4 border-l-hf-warning"
                      : "border-border-strong"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-text-primary ${unanswered ? "hf-type-strong" : "hf-type-body"}`}>
                      {request.subject}
                    </p>
                    <p className="hf-type-small truncate text-text-muted">
                      {request.user.displayName} · {request.user.email}
                    </p>
                  </div>
                  <div className="hf-type-small flex flex-wrap items-center gap-2">
                    {unanswered && (
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          overdue ? "bg-hf-red-dark text-hf-white" : "bg-hf-warning text-hf-warning-text"
                        }`}
                      >
                        Ikke besvaret · {formatWaiting(request.lastUserMessageAt, now)}
                      </span>
                    )}
                    {request.status === "RESOLVED" && (
                      <span className="rounded-full bg-hf-tan px-2 py-0.5 text-text-secondary">Løst</span>
                    )}
                    {request.status === "OPEN" && !unanswered && (
                      <span className="rounded-full bg-hf-green-dark px-2 py-0.5 text-hf-white">Besvaret</span>
                    )}
                    <span className="flex items-center gap-1 text-text-secondary">
                      <PriorityDot priority={request.priority} />
                      {SUPPORT_PRIORITY_LABELS[request.priority]}
                    </span>
                  </div>
                </div>
                <p className="hf-type-small mt-1 text-text-muted">
                  Sag {supportCaseCode(request.id)} · {SUPPORT_CATEGORY_LABELS[request.category]} · Seneste besked fra
                  bruger {formatAdminTime(request.lastUserMessageAt)} · {request._count.messages}{" "}
                  {request._count.messages === 1 ? "besked" : "beskeder"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
