import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { loadImportedDishes, parseDishParams } from "@/lib/admin-dishes";
import { DishListPage } from "@/components/admin/DishListPage";

// Admin → Retter → BetterFeast (docs/DECISIONS.md 2026-10-10): kun visning
// og Deaktivér, som HelloFresh.
export default async function AdminBetterFeastDishesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const { q, page } = parseDishParams(await searchParams);
  const data = await loadImportedDishes(q, page, "BETTERFEAST");
  return (
    <DishListPage
      title="BetterFeast-retter"
      intro="Alle BetterFeast-færdigretter; det natlige job henter ugens menu og spærrer retter, der ikke har været på menuen i fire måneder. Du kan kun deaktivere en ret."
      basePath="/admin/dishes/betterfeast"
      q={q}
      data={data}
      canDisable
      empty={q ? "Ingen retter matcher søgningen." : "Ingen BetterFeast-retter er importeret endnu."}
    />
  );
}
