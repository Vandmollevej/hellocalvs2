import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams, type DishSearchParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → Valdemarsro (docs/DECISIONS.md 2026-10-08). Retterne
// hentes hver nat af scripts/valdemarsro-agent; døde links spærres automatisk.
// Rækken åbner produktsiden (tilføj, "Gå til opskrift").
export default async function AdminValdemarsroDishesPage({
  searchParams,
}: {
  searchParams: Promise<DishSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page, deleted, problem } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "VALDEMARSRO", { deleted, problem });
  return (
    <DishListPage
      title="Valdemarsro-retter"
      intro="Retter fra Valdemarsro. Det natlige job finder nye retter og spærrer døde links. Markér rækker for at deaktivere, godkende, sende til gennemsyn eller slette."
      basePath="/admin/dishes/valdemarsro"
      q={q}
      data={data}
      deleted={deleted}
      problem={problem}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen Valdemarsro-retter er importeret endnu."}
    />
  );
}
