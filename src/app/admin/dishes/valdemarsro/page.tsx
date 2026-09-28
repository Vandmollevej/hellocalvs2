import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → Valdemarsro (docs/DECISIONS.md 2026-09-28). Scraperen
// findes (scripts/valdemarsro-import), men importen til appen er ikke bygget
// endnu (docs/STATUS.md, Waldemarsro-integration), så listen er tom.
export default async function AdminValdemarsroDishesPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  return (
    <DishListPage
      title="Valdemarsro-retter"
      intro="Retter fra Valdemarsro. Importen til appen er ikke bygget endnu."
      basePath="/admin/dishes/valdemarsro"
      q=""
      data={{ rows: [], total: 0, pageCount: 1, page: 1 }}
      empty="Ingen Valdemarsro-retter er importeret endnu."
    />
  );
}