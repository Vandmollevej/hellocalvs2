import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → RetNemt (docs/DECISIONS.md 2026-10-10): kun visning og
// Deaktivér, som HelloFresh.
export default async function AdminRetNemtDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "RETNEMT");
  return (
    <DishListPage
      title="RetNemt-retter"
      intro="Alle retter fra RetNemt; det natlige job henter nye retter og spærrer døde links. Du kan kun deaktivere en ret."
      basePath="/admin/dishes/retnemt"
      q={q}
      data={data}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen RetNemt-retter er importeret endnu."}
    />
  );
}
