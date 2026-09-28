import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getFlow } from "@/lib/flows";
import { FlowEditor } from "@/components/admin/FlowEditor";
import { HfChevron } from "@/components/hf/HfChevron";

export const dynamic = "force-dynamic";

// Ét flow i telefon-editoren (docs/DECISIONS.md 2026-09-27).
export default async function AdminFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const flow = await getFlow(id);
  if (!flow) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/flows" className="hf-btn-text w-fit text-hf-black">
        <HfChevron direction="left" compact />
        Alle flows
      </Link>
      <FlowEditor
        flow={{
          id: flow.id,
          name: flow.name,
          description: flow.description ?? "",
          enabled: flow.enabled,
          pages: flow.pages.map((page) => ({
            id: page.id,
            title: page.title,
            bodyHtml: page.bodyHtml,
            buttonLabel: page.buttonLabel,
          })),
        }}
      />
    </div>
  );
}
