import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams, type DishSearchParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → RetNemt (docs/DECISIONS.md 2026-10-10): kun visning og
// Deaktivér, som HelloFresh.
export default async function AdminRetNemtDishesPage({
  searchParams,
}: {
  searchParams: Promise<DishSearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page, deleted, problem } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "RETNEMT", { deleted, problem });
  return (
    <DishListPage
      title="RetNemt-retter"
      intro="Alle retter fra RetNemt; det natlige job henter nye retter og spærrer døde links. Markér rækker for at deaktivere, godkende, sende til gennemsyn eller slette."
      basePath="/admin/dishes/retnemt"
      q={q}
      data={data}
      deleted={deleted}
      problem={problem}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen RetNemt-retter er importeret endnu."}
    />
  );
}
