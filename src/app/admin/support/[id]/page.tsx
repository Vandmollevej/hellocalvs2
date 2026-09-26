import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import {
  getAdminSupportThread,
  isSupportOverdue,
  listSupportReplyTemplates,
  supportCaseCode,
} from "@/lib/support-inbox";
import { instantToDateKey, isSupportGrantActive } from "@/lib/support-access";
import { SUPPORT_PERMISSION_KEYS, readSupportPermissions } from "@/lib/support-permissions";
import { SUPPORT_CATEGORY_LABELS, formatAdminTime, formatWaiting } from "@/lib/support-labels";
import { SupportThreadActions } from "@/components/admin/SupportThreadActions";
import da from "@/i18n/locales/da.json";

const PERMISSION_LABELS = da.settings.support.permissions as Record<string, string>;

// Én supportsag som samtale (docs/DECISIONS.md 2026-09-26 "Support-indbakke").
// Interne noter vises kun her, aldrig for brugeren. Dataadgangen viser kun
// kategorier og periode — selve dataene læses aldrig herfra (docs/PRIVACY.md).
export default async function AdminSupportThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const [request, templates] = await Promise.all([getAdminSupportThread(id), listSupportReplyTemplates()]);
  if (!request) notFound();

  const now = new Date();
  const unanswered = request.status === "OPEN" && request.awaitingReply;
  const overdue = isSupportOverdue(request, now);
  const grant = request.supportGrant;
  const permissions = grant ? readSupportPermissions(grant.permissions) : null;
  const allowed = permissions ? SUPPORT_PERMISSION_KEYS.filter((key) => permissions[key]) : [];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/support" className="hf-type-small text-text-secondary hover:text-text-primary">
        ← Tilbage til indbakken
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="hf-type-title text-text-primary">{request.subject}</h1>
        <p className="hf-type-small text-text-muted">
          Sag {supportCaseCode(request.id)} · {SUPPORT_CATEGORY_LABELS[request.category]} · Oprettet{" "}
          {formatAdminTime(request.createdAt)}
        </p>
        <p className="hf-type-small text-text-secondary">
          {request.user.displayName} · {request.user.email} · bruger siden {instantToDateKey(request.user.createdAt)}
        </p>
        {unanswered && (
          <p className={`hf-type-small hf-type-strong ${overdue ? "text-hf-red-dark" : "text-hf-warning-text"}`}>
            Ikke besvaret — har ventet {formatWaiting(request.lastUserMessageAt, now)}
            {overdue && " (over 24 timer)"}
          </p>
        )}
      </div>

      <SupportThreadActions
        id={request.id}
        status={request.status}
        priority={request.priority}
        awaitingReply={request.awaitingReply}
        userName={request.user.displayName}
        templates={templates.map((template) => ({ id: template.id, title: template.title, body: template.body }))}
      />

      <ol className="flex flex-col gap-3">
        {request.messages.map((message) => {
          const style =
            message.author === "USER"
              ? "mr-8 border-border-strong bg-surface-2"
              : message.author === "SUPPORT"
                ? "ml-8 border-hf-green-dark bg-hf-green-light"
                : "ml-8 border-dashed border-hf-warning bg-hf-cream";
          const who =
            message.author === "USER"
              ? request.user.displayName
              : message.author === "SUPPORT"
                ? `${message.authorName ?? "Support"} (svar)`
                : `${message.authorName ?? "Support"} · intern note`;
          return (
            <li key={message.id} className={`rounded-lg border p-3 ${style}`}>
              <p className="hf-type-small text-text-muted">
                {who} · {formatAdminTime(message.createdAt)}
              </p>
              <p className="hf-type-body mt-1 whitespace-pre-wrap text-text-primary">{message.body}</p>
              {message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={`/api/admin/support/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-24 w-24 overflow-hidden rounded-md border border-border-strong bg-surface-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- beskyttet admin-route, ikke next/image */}
                      <img
                        src={`/api/admin/support/attachments/${attachment.id}`}
                        alt="Skærmbillede fra brugeren"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="hf-type-small rounded-lg border border-border-strong bg-surface-2 p-3 text-text-secondary">
        <span className="hf-type-strong text-text-primary">Dataadgang: </span>
        {!grant && "Ingen dataadgang givet."}
        {grant && (
          <>
            <span className={isSupportGrantActive(grant) ? "text-hf-green-dark" : "text-text-muted"}>
              {grant.revokedAt ? "Tilbagekaldt" : isSupportGrantActive(grant) ? "Aktiv" : "Ikke aktiv"}
            </span>{" "}
            · {instantToDateKey(grant.validFrom)} – {instantToDateKey(grant.validUntil)} ·{" "}
            {allowed.length ? allowed.map((key) => PERMISSION_LABELS[key] ?? key).join(", ") : "Ingen datatyper"}
          </>
        )}
      </div>
    </div>
  );
}
