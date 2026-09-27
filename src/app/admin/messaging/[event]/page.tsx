import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { MessageEvent as MessageEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ensureDefaultMessageTemplates } from "@/lib/messaging";
import { EVENT_LABELS } from "@/lib/message-event-labels";
import { MessageTemplateEditor } from "@/components/admin/MessageTemplateEditor";

export const dynamic = "force-dynamic";

// Én mail-/push-skabelon i telefon-editoren (docs/DECISIONS.md 2026-09-27).
export default async function AdminMessageTemplatePage({ params }: { params: Promise<{ event: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { event } = await params;
  await ensureDefaultMessageTemplates();
  const template = await prisma.messageTemplate
    .findUnique({ where: { event: event as MessageEventType } })
    .catch(() => null);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/messaging" className="hf-type-body text-text-secondary hover:text-hf-black">
        ← Tilbage til besked automatisering
      </Link>
      <MessageTemplateEditor
        label={EVENT_LABELS[template.event] ?? template.event}
        template={{
          event: template.event,
          channel: template.channel,
          enabled: template.enabled,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
        }}
      />
    </div>
  );
}
