import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ensureDefaultMessageTemplates } from "@/lib/messaging";
import { MessageDraftLoader } from "@/components/admin/MessageDraftLoader";

export const dynamic = "force-dynamic";

// Kladde: sandkasse til nye beskeder under Besked automatisering.
export default async function AdminMessageDraftPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  await ensureDefaultMessageTemplates();
  const templates = await prisma.messageTemplate.findMany({ orderBy: { event: "asc" } });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/messaging" className="hf-type-body text-text-secondary hover:text-hf-black">
        ← Tilbage til besked automatisering
      </Link>
      <MessageDraftLoader
        templates={templates.map((t) => ({
          event: t.event,
          channel: t.channel,
          enabled: t.enabled,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
        }))}
      />
    </div>
  );
}
