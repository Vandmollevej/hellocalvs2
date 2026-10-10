import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → Valdemarsro (docs/DECISIONS.md 2026-10-08). Retterne
// hentes hver nat af scripts/valdemarsro-agent; døde links spærres automatisk.
// Rækken åbner produktsiden (tilføj, "Gå til opskrift").
export default async function AdminValdemarsroDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "VALDEMARSRO");
  return (
    <DishListPage
      title="Valdemarsro-retter"
      intro="Retter fra Valdemarsro. Det natlige job finder nye retter og spærrer døde links. Du kan kun deaktivere en ret."
      basePath="/admin/dishes/valdemarsro"
      q={q}
      data={data}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen Valdemarsro-retter er importeret endnu."}
    />
  );
}
