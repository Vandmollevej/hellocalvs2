import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { listSupportReplyTemplates } from "@/lib/support-inbox";
import { SupportTemplateEditor } from "@/components/admin/SupportTemplateEditor";

// Svarskabeloner til Support-indbakken (docs/DECISIONS.md 2026-09-26).
export default async function AdminSupportTemplatesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const templates = await listSupportReplyTemplates();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/support" className="hf-type-small text-text-secondary hover:text-text-primary">
        ← Tilbage til indbakken
      </Link>
      <div>
        <h1 className="hf-type-title text-text-primary">Svarskabeloner</h1>
        <p className="hf-type-body text-text-secondary">
          Standardsvar, du kan indsætte i en sag. Skriv {"{{navn}}"}, hvor brugerens navn skal stå.
        </p>
      </div>
      <SupportTemplateEditor
        templates={templates.map((template) => ({
          id: template.id,
          title: template.title,
          body: template.body,
          sortOrder: template.sortOrder,
        }))}
      />
    </div>
  );
}
