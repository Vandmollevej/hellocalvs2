import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { PAGE_TREE } from "@/lib/page-tree";
import { PageTreeView } from "@/components/admin/PageTreeView";

// Admin "Page tree" (docs/DECISIONS.md 2026-09-27): samlet kort over alle
// sider i appen med undersider, så det er nemt at finde rundt og teste.
export const dynamic = "force-dynamic";

export default async function AdminPageTreePage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="hf-type-title text-hf-black">Page tree</h1>
        <p className="hf-type-body text-text-secondary">
          Alle sider i appen, ordnet efter hvor man kommer ind på dem. Pilene viser vejen fra en side til dens
          undersider. Tryk på en side for at åbne den i en ny fane, og sæt flueben når den er testet.
        </p>
      </div>
      <PageTreeView areas={PAGE_TREE} />
    </div>
  );
}
